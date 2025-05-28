import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { getSignedUrl } from '@/lib/storage/gcs'
import { withRetry } from '@/lib/utils/retry' // Updated import path for withRetry
import { 
  generateImageCaption, // This is now the primary caption generator
  generateStudySummary // Renamed from generateEnhancedStudySummary
  // generateSeriesSummary as generateSeriesSummaryGemini, // Not used in this file's current logic path
} from '@/lib/ai/gemini'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes for processing

// POST /api/studies/[id]/refresh - Refresh AI captions and summary for existing study
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Fetch the study with images
    const study = await prisma.study.findUnique({
      where: { id: params.id },
      include: {
        images: {
          orderBy: { sliceIndex: 'asc' }
        }
      }
    })

    if (!study) {
      return NextResponse.json(
        { error: 'Study not found' },
        { status: 404 }
      )
    }

    if (study.images.length === 0) {
      return NextResponse.json(
        { error: 'No images found in this study' },
        { status: 400 }
      )
    }

    // Process each image for new captions
    const imagePromises = study.images.map(async (image: typeof study.images[0]) => {
      try {
        // Get signed URL for the image
        const signedUrl = await getSignedUrl(image.gcsUrl)
        
        // Fetch the image data
        const imageResponse = await fetch(signedUrl)
        if (!imageResponse.ok) {
          throw new Error(`Failed to fetch image: ${imageResponse.statusText}`)
        }
        
        const imageBuffer = await imageResponse.arrayBuffer()
        const base64Image = Buffer.from(imageBuffer).toString('base64')

        // Generate caption using Gemini Flash
        let sliceCaptionAttempt: string | null = null;
        try {
          // generateImageCaption now takes 3 arguments: imageBase64, sliceIndex, totalSlices
          sliceCaptionAttempt = await withRetry(() => generateImageCaption(base64Image, image.sliceIndex, study.images.length));
        } catch (captionError) {
          console.error(`Gemini Flash captioning failed for image ${image.id}:`, captionError);
          sliceCaptionAttempt = "Caption refresh failed for this image.";
        }
        // Fallback to existing caption if refresh fails, otherwise use the new one or error string
        const sliceCaption = sliceCaptionAttempt || image.sliceCaption || "Caption not available.";


        // Update the image record
        const updatedImage = await prisma.image.update({
          where: { id: image.id },
          data: {
            sliceCaption: sliceCaption
          }
        })

        return { image: updatedImage, sliceCaption } // Return sliceCaption
      } catch (error) {
        console.error(`Error processing image ${image.id}:`, error)
        // Return existing sliceCaption if processing fails for this specific image
        return { 
          image, 
          sliceCaption: image.sliceCaption, 
        }
      }
    })

    // Wait for all images to be processed
    const results = await Promise.all(imagePromises)
    // Use slice captions for the summary
    const sliceCaptions = results.map(r => r.sliceCaption!) // Non-null assertion as we provide fallbacks

    // Generate study summary using Gemini Flash with slice captions
    let seriesSummary: string
    try {
      seriesSummary = await generateStudySummary( // Renamed function
        sliceCaptions,
        study.title,
        study.modality || undefined
      )
    } catch (error) {
      console.error('Error generating study summary with Gemini Flash during refresh:', error);
      seriesSummary = "Error: Could not refresh study summary."; 
    }

    // Update study with new summary
    const updatedStudy = await prisma.study.update({
      where: { id: study.id },
      data: { seriesSummary },
      include: {
        images: {
          orderBy: { sliceIndex: 'asc' }
        }
      }
    })

    return NextResponse.json({
      success: true,
      study: updatedStudy,
      message: 'AI captions and summary refreshed successfully'
    })

  } catch (error) {
    console.error('Error refreshing study:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to refresh study' },
      { status: 500 }
    )
  }
}
