import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { generateHolisticReport } from '@/lib/ai/gemini'

export const runtime = 'nodejs'
export const maxDuration = 60 // 1 minute for report generation

// POST /api/reports/generate - Generate a holistic report for a patient
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { patientId, includeCodes = false } = body

    // Validate required fields
    if (!patientId) {
      return NextResponse.json(
        { error: 'Missing required field: patientId' },
        { status: 400 }
      )
    }

    // Fetch patient with all studies
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        studies: {
          orderBy: { imagingDatetime: 'asc' }
        }
      }
    })

    if (!patient) {
      return NextResponse.json(
        { error: 'Patient not found' },
        { status: 404 }
      )
    }

    if (patient.studies.length === 0) {
      return NextResponse.json(
        { error: 'No studies found for this patient' },
        { status: 400 }
      )
    }

    // Prepare data for Gemini
    const patientData = {
      name: patient.name,
      age: patient.age,
      sex: patient.sex,
      reasonForImaging: patient.reasonForImaging || undefined
    }

    const studiesData = patient.studies.map((study: any) => ({
      id: study.id,
      title: study.title,
      imagingDatetime: study.imagingDatetime,
      seriesSummary: study.seriesSummary
    }))

    // Generate report using Gemini
    const reportOutput = await generateHolisticReport(
      patientData,
      studiesData,
      includeCodes
    )

    // Save report to database
    const report = await prisma.report.create({
      data: {
        patientId: patient.id,
        geminiJson: reportOutput as any // Prisma Json type
      }
    })

    // Update the most recent study with the report if needed
    if (patient.studies.length > 0) {
      const mostRecentStudy = patient.studies[patient.studies.length - 1]
      await prisma.study.update({
        where: { id: mostRecentStudy.id },
        data: {
          geminiJson: reportOutput as any,
          includeCodes
        }
      })
    }

    return NextResponse.json({
      id: report.id,
      patientId: patient.id,
      ...reportOutput,
      createdAt: report.createdAt
    }, { status: 201 })
  } catch (error) {
    console.error('Error generating report:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate report' },
      { status: 500 }
    )
  }
}
