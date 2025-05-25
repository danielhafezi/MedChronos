import { GoogleAuth } from 'google-auth-library'

// Initialize Google Auth
const auth = new GoogleAuth({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  scopes: ['https://www.googleapis.com/auth/cloud-platform']
})

const PROJECT_ID = process.env.GCP_PROJECT_ID!
const LOCATION = process.env.VERTEX_AI_LOCATION!
const MEDGEMMA_4B_ENDPOINT_ID = process.env.MEDGEMMA_4B_ENDPOINT_ID!
const MEDGEMMA_27B_ENDPOINT_ID = process.env.MEDGEMMA_27B_ENDPOINT_ID!

interface MedGemmaResponse {
  predictions: any[]
  deployedModelId: string
  model: string
  modelDisplayName: string
  modelVersionId: string
}

/**
 * Call MedGemma 4B for image captioning
 */
export async function generateImageCaption(imageBase64: string): Promise<string> {
  try {
    const client = await auth.getClient()
    const accessToken = await client.getAccessToken()
    
    const endpoint = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/endpoints/${MEDGEMMA_4B_ENDPOINT_ID}:predict`
    
    const requestBody = {
      instances: [{
        image: {
          bytesBase64Encoded: imageBase64
        },
        text: "Describe this medical image in detail, including any notable findings, anatomical structures, and potential abnormalities."
      }]
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('MedGemma 4B Error:', errorText)
      throw new Error(`MedGemma 4B API error: ${response.status}`)
    }

    const data: MedGemmaResponse = await response.json()
    
    // Extract the caption from the response
    if (data.predictions && data.predictions.length > 0) {
      return data.predictions[0].text || 'No caption generated'
    }
    
    return 'No caption generated'
  } catch (error) {
    console.error('Error calling MedGemma 4B:', error)
    throw new Error('Failed to generate image caption')
  }
}

/**
 * Call MedGemma 27B for text summarization
 */
export async function generateSeriesSummary(sliceCaptions: string[]): Promise<string> {
  try {
    const client = await auth.getClient()
    const accessToken = await client.getAccessToken()
    
    const endpoint = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/endpoints/${MEDGEMMA_27B_ENDPOINT_ID}:predict`
    
    const prompt = `Given the following medical image slice descriptions from a single imaging study, produce a concise study-level summary that captures the key findings, anatomical observations, and any potential abnormalities:

${sliceCaptions.map((caption, index) => `Slice ${index + 1}: ${caption}`).join('\n\n')}

Study Summary:`

    const requestBody = {
      instances: [{
        prompt: prompt
      }],
      parameters: {
        maxOutputTokens: 512,
        temperature: 0.1,
        topP: 0.95,
        topK: 40
      }
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('MedGemma 27B Error:', errorText)
      throw new Error(`MedGemma 27B API error: ${response.status}`)
    }

    const data: MedGemmaResponse = await response.json()
    
    // Extract the summary from the response
    if (data.predictions && data.predictions.length > 0) {
      return data.predictions[0].text || data.predictions[0].content || 'No summary generated'
    }
    
    return 'No summary generated'
  } catch (error) {
    console.error('Error calling MedGemma 27B:', error)
    throw new Error('Failed to generate series summary')
  }
}

/**
 * Retry wrapper for AI calls
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number = 1
): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    if (retries > 0) {
      console.log(`Retrying... (${retries} attempts remaining)`)
      await new Promise(resolve => setTimeout(resolve, 2000)) // Wait 2 seconds
      return withRetry(fn, retries - 1)
    }
    throw error
  }
}
