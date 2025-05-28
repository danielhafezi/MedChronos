/**
 * Retry wrapper for functions that might fail, e.g., AI calls.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number = 1,
  delayMs: number = 2000 // Added delay parameter with default
): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    if (retries > 0) {
      console.log(`Retrying... (${retries} attempts remaining). Waiting ${delayMs}ms.`);
      await new Promise(resolve => setTimeout(resolve, delayMs))
      return withRetry(fn, retries - 1, delayMs)
    }
    console.error('Function failed after multiple retries:', error);
    throw error
  }
}
