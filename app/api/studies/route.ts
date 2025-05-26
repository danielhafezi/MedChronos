import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { uploadToGCS } from '@/lib/storage/gcs'
import { processImage, isValidImageFormat } from '@/lib/utils/image-processing'
import { generateImageCaption as generateImageCaptionMedGemma, generateSeriesSummary as generateSeriesSummaryMedGemma, withRetry } from '@/lib/ai/medgemma'
import { generateStudyTitle, extractImagingDate, extractImagingModality, generateImageCaption as generateImageCaptionGemini, generateSeriesSummary as generateSeriesSummaryGemini, enhanceMedGemmaCaption, generateEnhancedStudySummary } from '@/lib/ai/gemini'

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
    const autoGenerateTitle = formData.get('autoGenerateTitle') === 'true'
    const autoExtractDate = formData.get('autoExtractDate') === 'true'
    const autoExtractModality = formData.get('autoExtractModality') === 'true'
    
    // Validate required fields
    if (!patientId || (!title && !autoGenerateTitle) || (!imagingDatetime && !autoExtractDate)) {
      return NextResponse.json(
        { error: 'Missing required fields: patientId, title (or autoGenerateTitle), imagingDatetime (or autoExtractDate)' },
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

    // Process first image for auto-generation features
    let finalTitle = title
    let finalDatetime = imagingDatetime
    let finalModality = modality
    let dateExtractionFailed = false
    
    if ((autoGenerateTitle || autoExtractDate || autoExtractModality) && files.length > 0) {
      try {
        const firstFile = files[0]
        const arrayBuffer = await firstFile.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const processed = await processImage(buffer)
        
        // Generate title if requested
        if (autoGenerateTitle) {
          try {
            finalTitle = await withRetry(() => 
              generateStudyTitle(processed.base64, modality || undefined)
            )
          } catch (error) {
            console.error('Error generating title:', error)
            finalTitle = 'Untitled Study' // Fallback title
          }
        }
        
        // Extract date if requested
        if (autoExtractDate) {
          try {
            const dateResult = await withRetry(() => 
              extractImagingDate(processed.base64)
            )
            
            if (dateResult.date && dateResult.confidence !== 'none') {
              finalDatetime = dateResult.date
            } else {
              // Date extraction failed - user must provide it manually
              dateExtractionFailed = true
            }
          } catch (error) {
            console.error('Error extracting date:', error)
            dateExtractionFailed = true
          }
        }
        
        // Extract modality if requested
        if (autoExtractModality) {
          try {
            const extractedModality = await withRetry(() => 
              extractImagingModality(processed.base64)
            )
            
            if (extractedModality) {
              finalModality = extractedModality
            }
          } catch (error) {
            console.error('Error extracting modality:', error)
            // Modality is optional, so we don't need to fail
          }
        }
      } catch (error) {
        console.error('Error processing image for auto-features:', error)
        if (autoGenerateTitle) finalTitle = 'Untitled Study'
        if (autoExtractDate) dateExtractionFailed = true
      }
    }
    
    // If date extraction was requested but failed, return error
    if (autoExtractDate && dateExtractionFailed) {
      return NextResponse.json(
        { 
          error: 'Could not extract date from image. Please enter the date manually.',
          requiresManualDate: true 
        },
        { status: 400 }
      )
    }

    // Create study record
    const study = await prisma.study.create({
      data: {
        patientId,
        title: finalTitle,
        modality: finalModality,
        imagingDatetime: new Date(finalDatetime),
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

        // Generate caption - try MedGemma first, fallback to Gemini
        let rawCaption: string
        try {
          rawCaption = await withRetry(() => 
            generateImageCaptionMedGemma(processed.base64)
          )
        } catch (error) {
          console.log('MedGemma failed, falling back to Gemini for image caption')
          rawCaption = await withRetry(() => 
            generateImageCaptionGemini(processed.base64)
          )
        }

        // Enhance the caption using Gemini Flash for better readability
        let enhancedCaption: string
        try {
          enhancedCaption = await enhanceMedGemmaCaption(rawCaption, index, files.length)
        } catch (error) {
          console.error('Error enhancing caption:', error)
          enhancedCaption = rawCaption // Fallback to raw caption
        }

        // Save image record with both raw and enhanced captions
        const image = await prisma.image.create({
          data: {
            studyId: study.id,
            gcsUrl: uploadResult.gcsUrl,
            publicUrl: uploadResult.publicUrl,
            sliceIndex: index,
            sliceCaption: rawCaption,
            enhancedCaption: enhancedCaption
          }
        })

        return { image, rawCaption, enhancedCaption }
      })

      // Wait for all images to be processed
      const results = await Promise.all(imagePromises)
      const enhancedCaptions = results.map(r => r.enhancedCaption)

      // Generate enhanced study summary using Gemini Flash with enhanced captions
      let seriesSummary: string
      try {
        seriesSummary = await generateEnhancedStudySummary(
          enhancedCaptions,
          finalTitle,
          finalModality || undefined
        )
      } catch (error) {
        console.error('Error generating enhanced summary, falling back to standard summary:', error)
        // Fallback to standard summary generation if enhanced fails
        const rawCaptions = results.map(r => r.rawCaption)
        try {
          seriesSummary = await withRetry(() => 
            generateSeriesSummaryMedGemma(rawCaptions)
          )
        } catch (fallbackError) {
          console.log('MedGemma 27B failed, falling back to Gemini for series summary')
          seriesSummary = await withRetry(() => 
            generateSeriesSummaryGemini(rawCaptions)
          )
        }
      }

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
