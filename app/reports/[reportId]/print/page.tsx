'use client';

import { useEffect, useState } from 'react';
import ReportDisplay from '@/app/components/ReportDisplay';
import { Patient, Report, Study } from '@prisma/client'; // Assuming these types exist

import { Prisma } from '@prisma/client'; // For JsonValue if needed, though Report type handles it

// Define a more specific type for the report object expected by ReportDisplay
// This type represents the data fetched from the backend
interface ReportWithDetails extends Report {
  patient: Patient & { studies: Study[] };
  studies: Study[]; 
  // geminiJson from Prisma Report is 'Prisma.JsonValue | null'
}

interface PrintReportPageProps {
  params: {
    reportId: string;
  };
}

export default function PrintReportPage({ params }: PrintReportPageProps) {
  const { reportId } = params;
  const [reportData, setReportData] = useState<ReportWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!reportId) return;

    const fetchReportData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Placeholder: In a real scenario, you would fetch specifically by reportId.
        // This might involve a new API endpoint: /api/reports/[reportId]
        // For now, let's assume we have a way to get the patientId to fetch the patient
        // and then find the report. This is a simplification for this step.
        // This fetch URL and logic will likely need to be adjusted.
        
        // A more realistic fetch would be directly for the report:
        const response = await fetch(`/api/reports/${reportId}`); // This endpoint needs to be created
        if (!response.ok) {
          throw new Error(`Failed to fetch report: ${response.statusText}`);
        }
        const data: ReportWithDetails = await response.json();
        setReportData(data);
      } catch (err) {
        console.error('Error fetching report data:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchReportData();
  }, [reportId]);

  if (loading) {
    return <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>Loading report...</div>;
  }

  if (error) {
    return <div style={{ padding: '20px', fontFamily: 'sans-serif', color: 'red' }}>Error: {error}</div>;
  }

  if (!reportData) {
    return <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>Report not found.</div>;
  }

  // Ensure geminiJson is not null and is a valid object before proceeding
  // Also, Prisma's JsonValue can be a primitive, array, or object. We need an object.
  if (typeof reportData.geminiJson !== 'object' || reportData.geminiJson === null || Array.isArray(reportData.geminiJson)) {
    return <div style={{ padding: '20px', fontFamily: 'sans-serif', color: 'orange' }}>Report JSON content is missing, null, or not an object.</div>;
  }

  // Type assertion for geminiJson based on ReportDisplayProps from the actual component file
  // This structure matches what ReportDisplay.tsx currently expects for report.geminiJson
  const geminiJsonForDisplay = reportData.geminiJson as { // Cast to the expected structure
    findings: string;
    impression: string;
    next_steps: string;
    citations?: { [key: string]: string };
    // Note: report_summary_statement and key_metrics are not in the read ReportDisplay.tsx
  };

  // Transform studies to match ReportDisplay's expected Study type (imagingDatetime as string)
  const studiesForDisplay = reportData.studies.map(study => ({
    ...study,
    imagingDatetime: new Date(study.imagingDatetime).toISOString(), // Convert Date to ISO string
  }));

  return (
    <div style={{ margin: '0 auto', padding: '10px' }}> {/* Basic styling for print */}
      <ReportDisplay
        report={{
          geminiJson: geminiJsonForDisplay,
          createdAt: new Date(reportData.createdAt).toLocaleDateString(), // Format Date to string
        }}
        patient={{
          name: reportData.patient.name,
          age: reportData.patient.age, // Prisma 'age' is Int, ReportDisplay 'age' is number
          sex: reportData.patient.sex,   // Prisma 'sex' is String, ReportDisplay 'sex' is string
          mrn: reportData.patient.mrn,   // Prisma 'mrn' is String?, ReportDisplay 'mrn' is string | null
        }}
        studies={studiesForDisplay} // Pass the transformed studies
        onCitationClick={(studyId) => {
          // Citations are not interactive in PDF, so this is a no-op.
          console.log(`Citation clicked for study ${studyId} (print view)`);
        }}
        // isLoading prop removed as it's not in the read ReportDisplay.tsx props
      />
    </div>
  );
}
