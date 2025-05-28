import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { getSignedUrl } from '@/lib/storage/gcs'
import { generateImageCaption as generateImageCaptionWithMedgemma, withRetry } from '@/lib/ai/medgemma' // Removed generateSeriesSummaryMedGemma
import { 
  generateImageCaption as generateImageCaptionWithGeminiFallback, // Aliased for clarity
  enhanceMedGemmaCaption, 
  generateEnhancedStudySummary 
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

        // Generate raw caption with MedGemma, fallback to Gemini Flash
        let rawCaptionAttempt: string | null = null;
        try {
          rawCaptionAttempt = await withRetry(() => generateImageCaptionWithMedgemma(base64Image));
        } catch (medgemmaError) {
          console.error(`MedGemma 4B captioning failed for image ${image.id}, falling back to Gemini Flash:`, medgemmaError);
          try {
            rawCaptionAttempt = await withRetry(() => generateImageCaptionWithGeminiFallback(base64Image));
          } catch (geminiFallbackError) {
            console.error(`Gemini Flash captioning fallback also failed for image ${image.id}:`, geminiFallbackError);
            // If both fail during refresh, we might want to keep the old caption or use an error string.
            // For now, let's use an error string to make it clear refresh failed for this caption.
            rawCaptionAttempt = "Caption refresh failed for this image."; 
          }
        }
        const rawCaption = rawCaptionAttempt || image.sliceCaption || "Caption not available."; // Fallback to existing if all else fails

        // Enhance the caption using Gemini Flash
        let enhancedCaption: string
        try {
          enhancedCaption = await enhanceMedGemmaCaption(rawCaption, image.sliceIndex, study.images.length)
        } catch (error) {
          console.error(`Error enhancing caption for image ${image.id} with Gemini Flash, using raw caption as fallback:`, error)
          enhancedCaption = rawCaption // Fallback to raw caption if enhancement fails
        }

        // Update the image record with new raw and enhanced captions
        const updatedImage = await prisma.image.update({
          where: { id: image.id },
          data: {
            sliceCaption: rawCaption,
            enhancedCaption: enhancedCaption
          }
        })

        return { image: updatedImage, rawCaption, enhancedCaption }
      } catch (error) {
        console.error(`Error processing image ${image.id}:`, error)
        // Return existing captions if processing fails for this specific image
        return { 
          image, 
          rawCaption: image.sliceCaption, 
          enhancedCaption: image.enhancedCaption || image.sliceCaption // Use existing enhanced or fallback to raw
        }
      }
    })

    // Wait for all images to be processed
    const results = await Promise.all(imagePromises)
    // Use enhanced captions for the primary summary
    const enhancedCaptions = results.map(r => r.enhancedCaption!) // Non-null assertion as we provide fallbacks

    // Generate study summary using Gemini Flash with enhanced captions
    let seriesSummary: string
    try {
      seriesSummary = await generateEnhancedStudySummary(
        enhancedCaptions,
        study.title,
        study.modality || undefined
      )
    } catch (error) {
      console.error('Error generating study summary with Gemini Flash during refresh:', error);
      seriesSummary = "Error: Could not refresh study summary."; // Hardcoded fallback, MedGemma 27B removed
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
