import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { getSignedUrl } from '@/lib/storage/gcs'
import { generateImageCaption as generateImageCaptionMedGemma, generateSeriesSummary as generateSeriesSummaryMedGemma, withRetry } from '@/lib/ai/medgemma'
import { generateImageCaption as generateImageCaptionGemini, generateSeriesSummary as generateSeriesSummaryGemini, enhanceMedGemmaCaption, generateEnhancedStudySummary } from '@/lib/ai/gemini'

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

        // Generate new caption - try MedGemma first, fallback to Gemini
        let rawCaption: string
        try {
          rawCaption = await withRetry(() => 
            generateImageCaptionMedGemma(base64Image)
          )
        } catch (error) {
          console.log('MedGemma failed, falling back to Gemini for image caption')
          rawCaption = await withRetry(() => 
            generateImageCaptionGemini(base64Image)
          )
        }

        // Enhance the caption using Gemini Flash for better readability
        let enhancedCaption: string
        try {
          enhancedCaption = await enhanceMedGemmaCaption(rawCaption, image.sliceIndex, study.images.length)
        } catch (error) {
          console.error('Error enhancing caption:', error)
          enhancedCaption = rawCaption // Fallback to raw caption
        }

        // Update the image record with new captions
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
        // Return existing captions if processing fails
        return { 
          image, 
          rawCaption: image.sliceCaption, 
          enhancedCaption: image.enhancedCaption || image.sliceCaption 
        }
      }
    })

    // Wait for all images to be processed
    const results = await Promise.all(imagePromises)
    const enhancedCaptions = results.map(r => r.enhancedCaption)

    // Generate new enhanced study summary using Gemini Flash with enhanced captions
    let seriesSummary: string
    try {
      seriesSummary = await generateEnhancedStudySummary(
        enhancedCaptions,
        study.title,
        study.modality || undefined
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
