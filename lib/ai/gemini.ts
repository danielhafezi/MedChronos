import { GoogleGenerativeAI } from '@google/generative-ai'

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro-preview-05-06' })

export interface PatientData {
  name: string
  age: number
  sex: string
  reasonForImaging?: string
}

export interface StudyData {
  title: string
  imagingDatetime: Date
  seriesSummary: string
}

export interface ReportOutput {
  findings: string
  impression: string
  next_steps: string
  icd10_codes?: string[]
  snomed_codes?: string[]
}

/**
 * Generate a holistic report using Gemini
 */
export async function generateHolisticReport(
  patient: PatientData,
  studies: StudyData[],
  includeCodes: boolean = false
): Promise<ReportOutput> {
  try {
    // Sort studies chronologically
    const sortedStudies = [...studies].sort(
      (a, b) => a.imagingDatetime.getTime() - b.imagingDatetime.getTime()
    )

    // Build the prompt
    const systemPrompt = `You are an expert radiologist with extensive experience in interpreting medical imaging studies. You provide comprehensive, accurate, and clinically relevant reports that help guide patient care.`

    const userPrompt = {
      patient_demo: {
        name: patient.name,
        age: patient.age,
        sex: patient.sex,
        reason: patient.reasonForImaging || 'Not specified'
      },
      studies: sortedStudies.map(study => ({
        title: study.title,
        date: study.imagingDatetime.toISOString(),
        summary: study.seriesSummary
      })),
      requested_schema: {
        findings: 'Detailed description of all relevant findings across all studies, noting any changes over time',
        impression: 'Concise summary of the most important findings and their clinical significance',
        next_steps: 'Recommended follow-up actions, additional imaging, or clinical interventions',
        ...(includeCodes && {
          icd10_codes: 'Array of relevant ICD-10 diagnosis codes',
          snomed_codes: 'Array of relevant SNOMED CT codes'
        })
      }
    }

    const prompt = `${systemPrompt}

Based on the following patient information and imaging studies, generate a comprehensive radiology report.

Patient Information and Studies:
${JSON.stringify(userPrompt, null, 2)}

Return a JSON response exactly matching the requested_schema format. Be thorough but concise, and ensure all findings are clinically relevant.`

    // Generate the report
    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()

    // Parse the JSON response
    try {
      // Extract JSON from the response (handle potential markdown formatting)
      const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/{[\s\S]*}/)
      const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : text
      const reportData = JSON.parse(jsonStr)

      // Validate the response structure
      if (!reportData.findings || !reportData.impression || !reportData.next_steps) {
        throw new Error('Invalid report structure')
      }

      return {
        findings: reportData.findings,
        impression: reportData.impression,
        next_steps: reportData.next_steps,
        ...(includeCodes && {
          icd10_codes: reportData.icd10_codes || [],
          snomed_codes: reportData.snomed_codes || []
        })
      }
    } catch (parseError) {
      console.error('Error parsing Gemini response:', parseError)
      console.error('Raw response:', text)
      throw new Error('Failed to parse report data')
    }
  } catch (error) {
    console.error('Error generating holistic report:', error)
    throw new Error('Failed to generate holistic report')
  }
}

/**
 * Generate a report for a single study (optional)
 */
export async function generateStudyReport(
  patient: PatientData,
  study: StudyData,
  includeCodes: boolean = false
): Promise<ReportOutput> {
  return generateHolisticReport(patient, [study], includeCodes)
}
