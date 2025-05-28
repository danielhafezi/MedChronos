import { GoogleGenerativeAI } from '@google/generative-ai'

// Initialize Gemini models
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const proModel = genAI.getGenerativeModel({ model: 'gemini-2.5-pro-preview-05-06' })
const flashModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-05-20' })

export interface PatientData {
  name: string
  age: number
  sex: string
  reasonForImaging?: string
}

export interface StudyData {
  id: string
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
  citations?: { [key: string]: string } // Map of citation IDs to study IDs
}

/**
 * Generate a comprehensive study summary using slice captions
 */
export async function generateStudySummary(
  sliceCaptions: string[],
  studyTitle: string,
  modality?: string
): Promise<string> {
  try {
    const prompt = `You are an expert radiologist creating a comprehensive summary of an imaging study.

Study Information:
- Title: ${studyTitle}
${modality ? `- Modality: ${modality}` : ''}
- Number of slices: ${sliceCaptions.length}

Slice Descriptions:
${sliceCaptions.map((caption, index) => `Slice ${index + 1}: ${caption}`).join('\n\n')}

Create a comprehensive study summary that:
1. Synthesizes findings across all slices
2. Identifies the most clinically significant observations
3. Notes any progression or variation between slices
4. Maintains proper medical terminology
5. Provides a clear overview suitable for clinical documentation
6. Is structured and easy to read

Do NOT add findings that aren't supported by the slice descriptions. Base your summary only on the information provided.

Study Summary:`

    const result = await flashModel.generateContent(prompt)
    const response = await result.response
    return response.text().trim()
  } catch (error) {
    console.error('Error generating study summary:', error)
    throw new Error('Failed to generate study summary')
  }
}

/**
 * Generate a detailed and readable caption for a medical image using Gemini 2.5 Flash.
 * This is the primary function for generating slice captions.
 */
export async function generateImageCaption(
  imageBase64: string,
  sliceIndex: number,
  totalSlices: number
): Promise<string> {
  try {
    const prompt = `You are an expert radiologist analyzing a medical image. This is slice ${sliceIndex + 1} of ${totalSlices} in an imaging study.

Provide a clear, readable, and comprehensive caption for this medical image slice that:
1. Describes the anatomical structures visible in plain language.
2. Highlights any notable findings or abnormalities.
3. Notes the imaging characteristics (e.g., contrast, quality, orientation, imaging plane/view).
4. Maintains medical accuracy without hallucination.
5. Is concise yet comprehensive (2-4 sentences typically).
6. Uses proper medical terminology where appropriate, but ensures overall readability.

Analyze this medical image slice and provide the caption.`

    const result = await flashModel.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: imageBase64
        }
      }
    ])
    
    const response = await result.response
    return response.text().trim()
  } catch (error) {
    console.error('Error generating image caption with Gemini Flash:', error)
    throw new Error('Failed to generate image caption')
  }
}

/**
 * Generate a series summary using Gemini (fallback for MedGemma)
 */
export async function generateSeriesSummary(sliceCaptions: string[]): Promise<string> {
  try {
    const prompt = `You are an expert radiologist. Given the following medical image slice descriptions from a single imaging study, produce a concise study-level summary that captures the key findings, anatomical observations, and any potential abnormalities.

Slice Descriptions:
${sliceCaptions.map((caption, index) => `Slice ${index + 1}: ${caption}`).join('\n\n')}

Provide a comprehensive yet concise summary that:
1. Synthesizes findings across all slices
2. Highlights the most significant observations
3. Notes any abnormalities or pathological findings
4. Maintains proper medical terminology
5. Follows standard radiology reporting conventions

Study Summary:`

    const result = await proModel.generateContent(prompt)
    const response = await result.response
    return response.text().trim()
  } catch (error) {
    console.error('Error generating series summary with Gemini:', error)
    throw new Error('Failed to generate series summary')
  }
}

/**
 * Generate a title for a medical imaging study based on the first image
 */
export async function generateStudyTitle(
  imageBase64: string,
  modality?: string
): Promise<string> {
  try {
    const systemPrompt = `You are an expert radiologist. Based on the provided medical image, generate a concise and descriptive title for this imaging study. The title should identify:
1. The body part or region imaged
2. The imaging technique or view (if apparent)
3. Any contrast or special techniques used (if visible)

The title should be professional, concise (3-8 words), and follow standard medical imaging naming conventions.
Examples: "Chest PA and Lateral", "Brain MRI with Contrast", "Abdominal CT Angiography", "Left Knee AP and Lateral"`

    const prompt = `${systemPrompt}

${modality ? `Imaging modality: ${modality}` : ''}

Analyze this medical image and provide only the title, nothing else.`

    // Use the vision model with the image
    const result = await proModel.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: imageBase64
        }
      }
    ])
    
    const response = await result.response
    const title = response.text().trim()
    
    // Clean up the title (remove quotes, extra punctuation, etc.)
    return title.replace(/^["']|["']$/g, '').replace(/\.$/, '').trim()
  } catch (error) {
    console.error('Error generating study title:', error)
    throw new Error('Failed to generate study title')
  }
}

/**
 * Extract imaging date from a medical image
 */
export async function extractImagingDate(
  imageBase64: string
): Promise<{ date: string | null; confidence: 'high' | 'medium' | 'low' | 'none' }> {
  try {
    const systemPrompt = `You are an expert at reading medical imaging reports and extracting dates. Look for the imaging date/acquisition date in the provided medical image. Common locations include:
1. Top or bottom corners of the image
2. Header information
3. DICOM overlay text
4. Printed report sections

IMPORTANT: Pay special attention to Iranian/Shamsi dates (Solar Hijri calendar) which may appear in formats like:
- 1402/03/15 (Shamsi year/month/day)
- 15/03/1402 (day/month/Shamsi year)  
- Persian numerals (۱۴۰۲/۰۳/۱۵)
- Farsi month names (فروردین، اردیبهشت، خرداد، etc.)

If you identify a Shamsi/Iranian date, convert it to Gregorian calendar before returning the ISO format.

Extract the date and convert it to ISO format (YYYY-MM-DD). If a time is also visible, include it (YYYY-MM-DDTHH:mm). Always ensure the final output uses Gregorian calendar dates.`

    const prompt = `${systemPrompt}

Analyze this medical image and extract the imaging/acquisition date. If you find a Shamsi/Iranian date, convert it to Gregorian calendar first. Return a JSON response with:
{
  "date": "YYYY-MM-DD or YYYY-MM-DDTHH:mm format (Gregorian calendar), or null if not found",
  "confidence": "high/medium/low/none",
  "originalFormat": "the date as it appears in the image (if found)",
  "shamsiDetected": "true if Shamsi date was detected and converted, false otherwise"
}`

    // Use the vision model with the image
    const result = await proModel.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: imageBase64
        }
      }
    ])
    
    const response = await result.response
    const text = response.text()
    
    try {
      // Extract JSON from the response
      const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/{[\s\S]*}/)
      const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : text
      const data = JSON.parse(jsonStr)
      
      // Validate and format the date if found
      if (data.date && data.confidence !== 'none') {
        // Ensure the date is valid
        const parsedDate = new Date(data.date)
        if (!isNaN(parsedDate.getTime())) {
          return {
            date: data.date,
            confidence: data.confidence
          }
        }
      }
      
      return { date: null, confidence: 'none' }
    } catch (parseError) {
      console.error('Error parsing date extraction response:', parseError)
      return { date: null, confidence: 'none' }
    }
  } catch (error) {
    console.error('Error extracting imaging date:', error)
    throw new Error('Failed to extract imaging date')
  }
}

/**
 * Extract imaging modality from a medical image
 */
export async function extractImagingModality(
  imageBase64: string
): Promise<string | null> {
  try {
    const systemPrompt = `You are an expert radiologist. Based on the provided medical image, identify the imaging modality. Common modalities include:
1. CT (Computed Tomography)
2. MRI (Magnetic Resonance Imaging)
3. X-Ray (Radiography)
4. US/Ultrasound
5. PET (Positron Emission Tomography)
6. NM (Nuclear Medicine)
7. MG (Mammography)
8. FL (Fluoroscopy)
9. DEXA (Bone Densitometry)

Look for visual cues like:
- Image characteristics (contrast, resolution, appearance)
- Any text overlays mentioning the modality
- Technical parameters displayed on the image
- Characteristic image features of each modality`

    const prompt = `${systemPrompt}

Analyze this medical image and identify the imaging modality. Return ONLY the modality abbreviation (e.g., CT, MRI, X-Ray, US) or null if you cannot determine it.`

    // Use the vision model with the image
    const result = await proModel.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: imageBase64
        }
      }
    ])
    
    const response = await result.response
    const modality = response.text().trim().toUpperCase()
    
    // Validate common modalities
    const validModalities = ['CT', 'MRI', 'X-RAY', 'US', 'ULTRASOUND', 'PET', 'NM', 'MG', 'FL', 'DEXA', 'CR', 'DX']
    
    if (validModalities.includes(modality)) {
      // Normalize some variations
      if (modality === 'ULTRASOUND') return 'US'
      if (modality === 'CR' || modality === 'DX') return 'X-Ray'
      return modality
    }
    
    return null
  } catch (error) {
    console.error('Error extracting imaging modality:', error)
    throw new Error('Failed to extract imaging modality')
  }
}

/**
 * Generate a holistic report using Gemini with citations
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

    // Create a mapping of study numbers for easier referencing
    const studyNumberMap = new Map<string, number>()
    sortedStudies.forEach((study, index) => {
      studyNumberMap.set(study.id, index + 1)
    })

    // Build the prompt
    const systemPrompt = `You are an expert radiologist with extensive experience in interpreting medical imaging studies. You provide comprehensive, accurate, and clinically relevant reports that help guide patient care.

IMPORTANT: When writing your report, you MUST cite the specific imaging study that supports each finding or statement. Use the format [CITE:study_id] where study_id is the ID of the study being referenced. You can cite multiple studies for a single statement using [CITE:study_id1,study_id2].

Example: "Mild ground-glass opacities are noted in the bilateral lower lobes [CITE:study_1]. These findings have progressed compared to the prior study [CITE:study_1,study_2]."

CITATION RULES:
1. EVERY medical finding, observation, or comparison MUST have a citation
2. Use the exact study IDs provided in the study data
3. When comparing studies, cite all relevant studies
4. General statements about the patient don't need citations
5. Recommendations should cite the studies that support them`

    const userPrompt = {
      patient_demo: {
        name: patient.name,
        age: patient.age,
        sex: patient.sex,
        reason: patient.reasonForImaging || 'Not specified'
      },
      studies: sortedStudies.map((study, index) => ({
        study_id: study.id,
        study_number: index + 1,
        title: study.title,
        date: study.imagingDatetime.toISOString(),
        summary: study.seriesSummary
      })),
      requested_schema: {
        findings: 'Detailed description of all relevant findings across all studies with proper citations [CITE:study_id]',
        impression: 'Concise summary of the most important findings and their clinical significance with citations',
        next_steps: 'Recommended follow-up actions, additional imaging, or clinical interventions with supporting citations',
        citations: 'An object mapping citation IDs to study IDs (automatically extracted from your text)',
        ...(includeCodes && {
          icd10_codes: 'Array of relevant ICD-10 diagnosis codes',
          snomed_codes: 'Array of relevant SNOMED CT codes'
        })
      }
    }

    const prompt = `${systemPrompt}

Based on the following patient information and imaging studies, generate a comprehensive radiology report with proper citations.

Patient Information and Studies:
${JSON.stringify(userPrompt, null, 2)}

Return a JSON response exactly matching the requested_schema format. Remember to include [CITE:study_id] citations in your findings, impression, and next_steps text. The citations object should map extracted citation references to actual study IDs.`

    // Generate the report
    const result = await proModel.generateContent(prompt)
    const response = await result.response
    const text = response.text()

    // Parse the JSON response
    try {
      // Extract JSON from the response (handle potential markdown formatting)
      const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/{[\s\S]*}/)
      const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : text
      const reportData = JSON.parse(jsonStr)

      // Validate the response structure and ensure all fields are strings
      if (!reportData.findings || !reportData.impression || !reportData.next_steps) {
        throw new Error('Invalid report structure')
      }

      // Extract citations from the text and create a mapping
      const citations: { [key: string]: string } = {}
      const citationPattern = /\[CITE:([^\]]+)\]/g
      
      // Extract from all text fields
      const allText = `${reportData.findings} ${reportData.impression} ${reportData.next_steps}`
      let match
      let citationCounter = 1
      
      while ((match = citationPattern.exec(allText)) !== null) {
        const studyIds = match[1].split(',').map(id => id.trim())
        studyIds.forEach(studyId => {
          if (!citations[studyId]) {
            citations[`cite_${citationCounter}`] = studyId
            citationCounter++
          }
        })
      }

      return {
        findings: String(reportData.findings || 'No findings available.'),
        impression: String(reportData.impression || 'No impression available.'),
        next_steps: String(reportData.next_steps || 'No next steps available.'),
        citations: citations,
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
