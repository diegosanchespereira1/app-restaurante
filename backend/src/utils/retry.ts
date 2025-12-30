/**
 * Retry utility following iFood best practices
 * Implements automatic retry for 5XX errors (500, 502, 503, 504)
 */

export interface RetryOptions {
  maxRetries?: number
  retryDelay?: number
  retryableStatusCodes?: number[]
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  retryDelay: 1000, // 1 second
  retryableStatusCodes: [500, 502, 503, 504]
}

/**
 * Retry a function that returns a promise
 * Follows iFood best practices: retry on 5XX errors
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
      lastError = error

      // Check if error is retryable (5XX status code)
      const statusCode = error.response?.status || error.status
      const isRetryable = opts.retryableStatusCodes.includes(statusCode)

      // Don't retry if:
      // - Not a retryable error
      // - Last attempt
      // - Error is not from server (4XX client errors)
      if (!isRetryable || attempt === opts.maxRetries) {
        throw error
      }

      // Calculate delay with exponential backoff
      const delay = opts.retryDelay * Math.pow(2, attempt)
      console.log(`Retry attempt ${attempt + 1}/${opts.maxRetries} after ${delay}ms for status ${statusCode}`)
      
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError || new Error('Retry failed')
}

/**
 * Check if error is a timeout error
 */
export function isTimeoutError(error: any): boolean {
  return error.code === 'ECONNABORTED' || 
         error.message?.includes('timeout') ||
         error.message?.includes('TIMEOUT')
}

