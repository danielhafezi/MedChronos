import sharp from 'sharp'

export interface ProcessedImage {
  buffer: Buffer
  base64: string
  mimeType: string
}

/**
 * Process an image to 896x896 JPEG with center crop
 */
export async function processImage(buffer: Buffer): Promise<ProcessedImage> {
  try {
    // Process the image with Sharp
    const processedBuffer = await sharp(buffer)
      .resize(896, 896, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({
        quality: 90,
        mozjpeg: true
      })
      .toBuffer()

    // Convert to base64 for AI processing
    const base64 = processedBuffer.toString('base64')

    return {
      buffer: processedBuffer,
      base64,
      mimeType: 'image/jpeg'
    }
  } catch (error) {
    console.error('Error processing image:', error)
    throw new Error('Failed to process image')
  }
}

/**
 * Extract metadata from an image
 */
export async function getImageMetadata(buffer: Buffer) {
  try {
    const metadata = await sharp(buffer).metadata()
    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: buffer.length
    }
  } catch (error) {
    console.error('Error extracting metadata:', error)
    throw new Error('Failed to extract image metadata')
  }
}

/**
 * Validate if the file is a supported image format
 */
export function isValidImageFormat(mimeType: string): boolean {
  const supportedFormats = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'application/dicom'
  ]
  return supportedFormats.includes(mimeType.toLowerCase())
}

/**
 * Convert DICOM to JPEG if needed
 * Note: For MVP, we'll treat DICOM files as regular images
 * In production, you'd use a specialized DICOM library
 */
export async function convertDicomIfNeeded(
  buffer: Buffer,
  mimeType: string
): Promise<Buffer> {
  if (mimeType === 'application/dicom') {
    // For MVP, we'll attempt to process DICOM as a regular image
    // In production, use a proper DICOM library like dcmjs
    console.warn('DICOM file detected. Using simplified processing for MVP.')
  }
  return buffer
}
