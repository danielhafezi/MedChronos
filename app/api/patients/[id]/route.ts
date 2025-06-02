import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { deleteFolder, getSignedUrl } from '@/lib/storage/gcs'

// GET /api/patients/[id] - Get a specific patient with studies
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const patient = await prisma.patient.findUnique({
      where: { id: params.id },
      include: {
        studies: {
          include: {
            images: true
          },
          orderBy: { imagingDatetime: 'asc' }
        },
        reports: {
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    if (!patient) {
      return NextResponse.json(
        { error: 'Patient not found' },
        { status: 404 }
      )
    }

    // Generate signed URLs for each image
    const patientWithSignedUrls = {
      ...patient,
      studies: await Promise.all(
        patient.studies.map(async (study: any) => ({
          ...study,
          images: await Promise.all(
            study.images.map(async (image: any) => ({
              ...image,
              signedUrl: await getSignedUrl(image.gcsUrl),
            }))
          ),
        }))
      ),
    }

    return NextResponse.json(patientWithSignedUrls)
  } catch (error) {
    console.error('Error fetching patient:', error)
    return NextResponse.json(
      { error: 'Failed to fetch patient' },
      { status: 500 }
    )
  }
}

// DELETE /api/patients/[id] - Delete a patient and all associated data
export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    // Check if patient exists
    const patient = await prisma.patient.findUnique({
      where: { id: params.id },
      include: {
        studies: {
          include: {
            images: true
          }
        }
      }
    })

    if (!patient) {
      return NextResponse.json(
        { error: 'Patient not found' },
        { status: 404 }
      )
    }

    // Delete all images from GCS
    const deletePromises: Promise<void>[] = []
    
    // Delete patient folder in GCS
    deletePromises.push(deleteFolder(`patients/${params.id}`))

    // Wait for GCS deletions
    await Promise.all(deletePromises)

    // Delete from database (cascade will handle related records)
    await prisma.patient.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ message: 'Patient deleted successfully' })
  } catch (error) {
    console.error('Error deleting patient:', error)
    return NextResponse.json(
      { error: 'Failed to delete patient' },
      { status: 500 }
    )
  }
}
