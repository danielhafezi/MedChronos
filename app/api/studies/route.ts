import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { uploadToGCS } from '@/lib/storage/gcs'
import { processImage, isValidImageFormat } from '@/lib/utils/image-processing'
import { withRetry } from '@/lib/utils/retry' // Updated import path for withRetry
import { 
  generateStudyTitle, 
  extractImagingDate, 
  extractImagingModality, 
  generateImageCaption, // This is now the primary caption generator
  generateStudySummary // Renamed from generateEnhancedStudySummary
  // generateSeriesSummary as generateSeriesSummaryGemini, // Not used in this file's current logic path
} from '@/lib/ai/gemini'

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

        // Generate caption using Gemini Flash
        let sliceCaptionAttempt: string | null = null;
        try {
          // generateImageCaption now takes 3 arguments: imageBase64, sliceIndex, totalSlices
          sliceCaptionAttempt = await withRetry(() => generateImageCaption(processed.base64, index, files.length));
        } catch (captionError) {
          console.error(`Gemini Flash captioning failed for image ${index + 1}:`, captionError);
          sliceCaptionAttempt = "Caption generation failed for this image.";
        }
        const sliceCaption = sliceCaptionAttempt || "Caption not available.";

        // Save image record
        const image = await prisma.image.create({
          data: {
            studyId: study.id,
            gcsUrl: uploadResult.gcsUrl,
            sliceIndex: index,
            sliceCaption: sliceCaption
          }
        })

        return { image, sliceCaption } // Return sliceCaption
      })

      // Wait for all images to be processed
      const results = await Promise.all(imagePromises)
      // Use slice captions for the summary
      const sliceCaptions = results.map(r => r.sliceCaption)

      // Generate study summary using Gemini Flash with slice captions
      let seriesSummary: string
      try {
        seriesSummary = await generateStudySummary( // Renamed function
          sliceCaptions,
          finalTitle, // Use the determined finalTitle for the study
          finalModality || undefined // Use the determined finalModality
        )
      } catch (error) {
        console.error('Error generating study summary with Gemini Flash:', error);
        seriesSummary = "Error: Could not generate study summary."; 
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
