import { Storage } from '@google-cloud/storage'
import { v4 as uuidv4 } from 'uuid'

// Initialize GCS client
const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
})

const bucketName = process.env.GCS_BUCKET_NAME!
const bucket = storage.bucket(bucketName)

export interface UploadResult {
  gcsUrl: string
  fileName: string
}

/**
 * Upload a file to Google Cloud Storage
 */
export async function uploadToGCS(
  buffer: Buffer,
  mimeType: string,
  folder: string
): Promise<UploadResult> {
  const fileName = `${folder}/${uuidv4()}.jpg`
  const file = bucket.file(fileName)

  try {
    await file.save(buffer, {
      metadata: {
        contentType: mimeType,
      },
      public: false,
      resumable: false,
    })

    // Generate the GCS URL
    const gcsUrl = `gs://${bucketName}/${fileName}`

    return {
      gcsUrl,
      fileName,
    }
  } catch (error) {
    console.error('Error uploading to GCS:', error)
    throw new Error('Failed to upload file to storage')
  }
}

/**
 * Delete a file from Google Cloud Storage
 */
export async function deleteFromGCS(fileName: string): Promise<void> {
  try {
    // Extract file path from gs:// URL if provided
    const filePath = fileName.startsWith('gs://')
      ? fileName.replace(`gs://${bucketName}/`, '')
      : fileName

    await bucket.file(filePath).delete()
  } catch (error) {
    console.error('Error deleting from GCS:', error)
    // Don't throw error on delete failures
  }
}

/**
 * Get a signed URL for temporary access to a file
 */
export async function getSignedUrl(fileName: string): Promise<string> {
  try {
    // Extract file path from gs:// URL if provided
    const filePath = fileName.startsWith('gs://')
      ? fileName.replace(`gs://${bucketName}/`, '')
      : fileName

    const [url] = await bucket.file(filePath).getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    })

    return url
  } catch (error) {
    console.error('Error generating signed URL:', error)
    throw new Error('Failed to generate signed URL')
  }
}

/**
 * Delete all files in a folder (used for cleanup when deleting patients/studies)
 */
export async function deleteFolder(folderPath: string): Promise<void> {
  try {
    const [files] = await bucket.getFiles({ prefix: folderPath })
    
    const deletePromises = files.map(file => file.delete())
    await Promise.all(deletePromises)
  } catch (error) {
    console.error('Error deleting folder:', error)
    // Don't throw error on delete failures
  }
}
