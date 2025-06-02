import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

export async function GET(request: Request, props: { params: Promise<{ reportId: string }> }) {
  const params = await props.params;
  const { reportId } = params;

  if (!reportId) {
    return NextResponse.json({ error: 'Report ID is required' }, { status: 400 });
  }

  try {
    const report = await prisma.report.findUnique({
      where: { id: reportId },
      include: {
        patient: {
          include: {
            studies: {
              orderBy: {
                imagingDatetime: 'asc',
              },
            },
          },
        },
      },
    });

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // The ReportDisplay component also expects a 'studies' array at the same level as 'patient'
    // containing all studies for that patient, for context like date ranges.
    // The patient object already contains these studies. We can duplicate it or rely on client to use patient.studies.
    // For simplicity and to match ReportWithDetails, let's ensure 'studies' is directly available.
    const reportWithAllStudies = {
      ...report,
      studies: report.patient.studies, // Add studies directly to the report object for convenience
    };

    return NextResponse.json(reportWithAllStudies);
  } catch (error) {
    console.error(`Error fetching report ${reportId}:`, error);
    return NextResponse.json({ error: 'Failed to fetch report' }, { status: 500 });
  }
}
