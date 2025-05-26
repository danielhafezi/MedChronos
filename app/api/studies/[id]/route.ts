import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

// GET /api/studies/[id] - Get a specific study
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const study = await prisma.study.findUnique({
      where: { id: params.id },
      include: {
        images: true
      }
    })

    if (!study) {
      return NextResponse.json(
        { error: 'Study not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(study)
  } catch (error) {
    console.error('Error fetching study:', error)
    return NextResponse.json(
      { error: 'Failed to fetch study' },
      { status: 500 }
    )
  }
}

// PATCH /api/studies/[id] - Update a study
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { title, modality, imagingDatetime } = body

    // Validate at least one field is provided
    if (!title && !modality && imagingDatetime === undefined) {
      return NextResponse.json(
        { error: 'At least one field to update is required' },
        { status: 400 }
      )
    }

    const updateData: any = {}
    if (title !== undefined) updateData.title = title
    if (modality !== undefined) updateData.modality = modality
    if (imagingDatetime !== undefined) {
      // Ensure the date is properly formatted
      updateData.imagingDatetime = new Date(imagingDatetime)
    }

    const study = await prisma.study.update({
      where: { id: params.id },
      data: updateData,
      include: {
        images: true
      }
    })

    return NextResponse.json(study)
  } catch (error) {
    console.error('Error updating study:', error)
    return NextResponse.json(
      { error: 'Failed to update study' },
      { status: 500 }
    )
  }
}

// DELETE /api/studies/[id] - Delete a study
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // The study deletion will cascade to images due to the onDelete: Cascade in the schema
    await prisma.study.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting study:', error)
    return NextResponse.json(
      { error: 'Failed to delete study' },
      { status: 500 }
    )
  }
}
