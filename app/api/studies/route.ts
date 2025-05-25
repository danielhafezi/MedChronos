import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { uploadToGCS } from '@/lib/storage/gcs'
import { processImage, isValidImageFormat } from '@/lib/utils/image-processing'
import { generateImageCaption, generateSeriesSummary, withRetry } from '@/lib/ai/medgemma'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes for processing

// POST /api/studies - Upload and process a study
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    
    // Extract form fields
    const patientId = formData.get('patientId') as string
    const title = formData.get('title') as string
    const modality = formData.get('modality') as string | null
    const imagingDatetime = formData.get('imagingDatetime') as string
    
    // Validate required fields
    if (!patientId || !title || !imagingDatetime) {
      return NextResponse.json(
        { error: 'Missing required fields: patientId, title, imagingDatetime' },
        { status: 400 }
      )
    }

    // Verify patient exists
    const patient = await prisma.patient.findUnique({
      where: { id: patientId }
    })

    if (!patient) {
      return NextResponse.json(
        { error: 'Patient not found' },
        { status: 404 }
      )
    }

    // Extract files
    const files: File[] = []
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('file') && value instanceof File) {
        files.push(value)
      }
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      )
    }

    // Create study record
    const study = await prisma.study.create({
      data: {
        patientId,
        title,
        modality,
        imagingDatetime: new Date(imagingDatetime),
        seriesSummary: 'Processing...',
        includeCodes: false
      }
    })

    try {
      // Process each image
      const imagePromises = files.map(async (file, index) => {
        // Validate file type
        if (!isValidImageFormat(file.type)) {
          throw new Error(`Invalid file type: ${file.type}`)
        }

        // Read file as buffer
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        // Process image to 896x896 JPEG
        const processed = await processImage(buffer)

        // Upload to GCS
        const uploadResult = await uploadToGCS(
          processed.buffer,
          processed.mimeType,
          `patients/${patientId}/studies/${study.id}`
        )

        // Generate caption using MedGemma 4B
        const caption = await withRetry(() => 
          generateImageCaption(processed.base64)
        )

        // Save image record
        const image = await prisma.image.create({
          data: {
            studyId: study.id,
            gcsUrl: uploadResult.gcsUrl,
            sliceIndex: index,
            sliceCaption: caption
          }
        })

        return { image, caption }
      })

      // Wait for all images to be processed
      const results = await Promise.all(imagePromises)
      const sliceCaptions = results.map(r => r.caption)

      // Generate series summary using MedGemma 27B
      const seriesSummary = await withRetry(() => 
        generateSeriesSummary(sliceCaptions)
      )

      // Update study with summary
      const updatedStudy = await prisma.study.update({
        where: { id: study.id },
        data: { seriesSummary },
        include: {
          images: true
        }
      })

      return NextResponse.json(updatedStudy, { status: 201 })
    } catch (processingError) {
      // If processing fails, delete the study
      await prisma.study.delete({ where: { id: study.id } })
      throw processingError
    }
  } catch (error) {
    console.error('Error processing study:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process study' },
      { status: 500 }
    )
  }
}
