import { GoogleAuth } from 'google-auth-library'

// Initialize Google Auth
const auth = new GoogleAuth({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  scopes: ['https://www.googleapis.com/auth/cloud-platform']
})

const APP_PROJECT_ID = process.env.GCP_PROJECT_ID! // Renamed to avoid confusion
const LOCATION = process.env.VERTEX_AI_LOCATION!
const MEDGEMMA_MODEL_HOST_PROJECT_ID = '744301221446' // Project ID from the sample request URL
const MEDGEMMA_4B_ENDPOINT_ID = process.env.MEDGEMMA_4B_ENDPOINT_ID!
// const MEDGEMMA_27B_ENDPOINT_ID = process.env.MEDGEMMA_27B_ENDPOINT_ID! // No longer used

interface MedGemmaChatChoice {
  message?: {
    content?: string;
  };
  // Add other properties from 'choice' if needed, like 'finish_reason', 'index'
}

interface MedGemmaChatPredictions {
  choices?: MedGemmaChatChoice[];
  // Add other properties from 'predictions' object if needed
}

interface MedGemmaResponse {
  predictions: MedGemmaChatPredictions | any; // More specific type or any for flexibility
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
    
    // Construct the endpoint URL based on the sample request provided by the user
    const endpoint = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${MEDGEMMA_MODEL_HOST_PROJECT_ID}/locations/${LOCATION}/endpoints/${MEDGEMMA_4B_ENDPOINT_ID}:predict`
    
    const requestBody = {
      instances: [{
        "@requestFormat": "chatCompletions",
        "messages": [
          {
            "role": "system",
            "content": [{"type": "text", "text": "You are an expert medical radiologist. Analyze medical images and provide detailed, accurate descriptions of findings."}]
          },
          {
            "role": "user",
            "content": [
              {
                "type": "text",
                "text": "Describe this medical image in detail, including any notable findings, anatomical structures, and potential abnormalities."
              },
              {
                "type": "image_url",
                "image_url": {"url": `data:image/jpeg;base64,${imageBase64}`}
              }
            ]
          }
        ],
        "max_tokens": 256
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
    
    console.log('MedGemma 4B Response:', JSON.stringify(data, null, 2))
    
    // Extract the caption from the response (chat completions format)
    // Based on logs, data.predictions is an array, where data.predictions[0] is another array,
    // and data.predictions[0][0] is the object containing the message.
    if (Array.isArray(data.predictions) && 
        data.predictions.length > 0 &&
        Array.isArray(data.predictions[0]) &&
        data.predictions[0].length > 0) {
      
      const choice = data.predictions[0][0] // This should be the object like { message: { content: "..." } }
      
      if (choice && choice.message && typeof choice.message.content === 'string') {
        return choice.message.content
      }
    }
    console.error('Unexpected MedGemma 4B response structure or empty content:', JSON.stringify(data, null, 2))
    
    return 'No caption generated'
  } catch (error) {
    console.error('Error calling MedGemma 4B:', error)
    throw new Error('Failed to generate image caption')
  }
}

// MedGemma 27B (generateSeriesSummary) is no longer used as per user request.
// The function has been removed.

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
