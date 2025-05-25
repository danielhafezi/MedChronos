import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

// GET /api/health - Health check endpoint
export async function GET() {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`
    
    // Check environment variables
    const config = {
      database: !!process.env.DATABASE_URL,
      gcp: {
        projectId: !!process.env.GCP_PROJECT_ID,
        credentials: !!process.env.GOOGLE_APPLICATION_CREDENTIALS,
        bucket: !!process.env.GCS_BUCKET_NAME,
      },
      ai: {
        vertexLocation: !!process.env.VERTEX_AI_LOCATION,
        medgemma4b: !!process.env.MEDGEMMA_4B_ENDPOINT_ID,
        medgemma27b: !!process.env.MEDGEMMA_27B_ENDPOINT_ID,
        geminiKey: !!process.env.GEMINI_API_KEY,
      }
    }

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      config
    })
  } catch (error) {
    console.error('Health check failed:', error)
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 503 })
  }
}
