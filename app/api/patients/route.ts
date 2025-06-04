import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

// GET /api/patients - List all patients
export async function GET() {
  try {
    const patients = await prisma.patient.findMany({
      orderBy: { createdAt: 'desc' },
      // take: 6, // Recent 6 patients as per PRD - Removed to fetch all patients
      include: {
        _count: {
          select: {
            studies: true,
            reports: true
          }
        }
      }
    })

    return NextResponse.json(patients)
  } catch (error) {
    console.error('Error fetching patients:', error)
    return NextResponse.json(
      { error: 'Failed to fetch patients' },
      { status: 500 }
    )
  }
}

// POST /api/patients - Create a new patient
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate required fields
    if (!body.name || !body.age || !body.sex) {
      return NextResponse.json(
        { error: 'Missing required fields: name, age, sex' },
        { status: 400 }
      )
    }

    // Validate sex value
    if (!['M', 'F', 'Other'].includes(body.sex)) {
      return NextResponse.json(
        { error: 'Invalid sex value. Must be M, F, or Other' },
        { status: 400 }
      )
    }

    // Create patient
    const patient = await prisma.patient.create({
      data: {
        name: body.name,
        age: body.age,
        sex: body.sex,
        mrn: body.mrn || null,
        reasonForImaging: body.reasonForImaging || null
      }
    })

    return NextResponse.json(patient, { status: 201 })
  } catch (error) {
    console.error('Error creating patient:', error)
    return NextResponse.json(
      { error: 'Failed to create patient' },
      { status: 500 }
    )
  }
}
