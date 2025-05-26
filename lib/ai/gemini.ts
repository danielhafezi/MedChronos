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
 * Generate a detailed caption for a medical image (fallback for MedGemma)
 */
export async function generateImageCaption(imageBase64: string): Promise<string> {
  try {
    const systemPrompt = `You are an expert radiologist analyzing medical images. Provide a detailed, technical description of the medical image including:
1. Anatomical structures visible
2. Imaging plane/view
3. Any notable findings or abnormalities
4. Technical quality of the image
5. Any contrast or special techniques used

Be specific and use proper medical terminology. This caption will be used for further AI analysis.`

    const prompt = `${systemPrompt}

Analyze this medical image and provide a comprehensive technical description.`

    // Use the vision model with the image
    const result = await model.generateContent([
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
    console.error('Error generating image caption with Gemini:', error)
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

    const result = await model.generateContent(prompt)
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
    const result = await model.generateContent([
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

Extract the date and convert it to ISO format (YYYY-MM-DD). If a time is also visible, include it (YYYY-MM-DDTHH:mm).`

    const prompt = `${systemPrompt}

Analyze this medical image and extract the imaging/acquisition date. Return a JSON response with:
{
  "date": "YYYY-MM-DD or YYYY-MM-DDTHH:mm format, or null if not found",
  "confidence": "high/medium/low/none",
  "originalFormat": "the date as it appears in the image (if found)"
}`

    // Use the vision model with the image
    const result = await model.generateContent([
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
    const result = await model.generateContent([
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

      // Validate the response structure and ensure all fields are strings
      if (!reportData.findings || !reportData.impression || !reportData.next_steps) {
        throw new Error('Invalid report structure')
      }

      return {
        findings: String(reportData.findings || 'No findings available.'),
        impression: String(reportData.impression || 'No impression available.'),
        next_steps: String(reportData.next_steps || 'No next steps available.'),
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
