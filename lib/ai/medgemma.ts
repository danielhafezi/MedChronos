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
    
    // Use dedicated endpoint domain for MedGemma 4B
    const endpoint = `https://${MEDGEMMA_4B_ENDPOINT_ID}.${LOCATION}-744301221446.prediction.vertexai.goog/v1/projects/${PROJECT_ID}/locations/${LOCATION}/endpoints/${MEDGEMMA_4B_ENDPOINT_ID}:predict`
    
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
    if (data.predictions && typeof data.predictions === 'object' && !Array.isArray(data.predictions) && data.predictions.choices && data.predictions.choices.length > 0) {
      const choice = data.predictions.choices[0]
      if (choice.message && choice.message.content) {
        return choice.message.content
      }
    }
    console.error('Unexpected MedGemma 4B response structure:', JSON.stringify(data, null, 2))
    
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
    
    // Use dedicated endpoint domain for MedGemma 27B
    const endpoint = `https://${MEDGEMMA_27B_ENDPOINT_ID}.${LOCATION}-744301221446.prediction.vertexai.goog/v1/projects/${PROJECT_ID}/locations/${LOCATION}/endpoints/${MEDGEMMA_27B_ENDPOINT_ID}:predict`
    
    const prompt = `Given the following medical image slice descriptions from a single imaging study, produce a concise study-level summary that captures the key findings, anatomical observations, and any potential abnormalities:

${sliceCaptions.map((caption, index) => `Slice ${index + 1}: ${caption}`).join('\n\n')}

Study Summary:`

    const requestBody = {
      instances: [{
        "@requestFormat": "chatCompletions",
        "messages": [
          {
            "role": "system",
            "content": [{"type": "text", "text": "You are an expert medical radiologist. Provide a concise, study-level summary of medical image findings. Output ONLY the summary text, without any preamble, thinking process, or XML-like tags."}]
          },
          {
            "role": "user",
            "content": [{"type": "text", "text": prompt}]
          }
        ],
        "max_tokens": 512, // As per sample, max_tokens is inside instances
        // Moving other parameters inside the instance, assuming chatCompletions format applies them here
        "temperature": 0.1,
        "topP": 0.95,
        "topK": 40
      }]
      // Parameters moved into the 'instances' object for chatCompletions format
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
    
    // Extract the summary from the response (chat completions format)
    if (data.predictions && data.predictions.choices && data.predictions.choices.length > 0) {
      const choice = data.predictions.choices[0]
      if (choice.message && choice.message.content) {
        return choice.message.content
      }
    }
    console.error('Unexpected MedGemma 27B response structure:', JSON.stringify(data, null, 2))
    
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
