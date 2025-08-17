import { toast } from '@/hooks/use-toast'

/**
 * Standardized error types for the application
 */
export enum ErrorType {
  VALIDATION = 'validation',
  NETWORK = 'network',
  SERVER = 'server',
  FILE_PROCESSING = 'file_processing',
  AUTHENTICATION = 'authentication',
  PERMISSION = 'permission',
  NOT_FOUND = 'not_found',
  UNKNOWN = 'unknown'
}

/**
 * Standardized error interface
 */
export interface AppError {
  type: ErrorType
  message: string
  details?: string
  code?: string | number
  field?: string // For validation errors
  originalError?: unknown
}

/**
 * Error messages configuration
 */
const ERROR_MESSAGES = {
  [ErrorType.VALIDATION]: {
    title: 'Błąd walidacji',
    defaultMessage: 'Wprowadzone dane są nieprawidłowe'
  },
  [ErrorType.NETWORK]: {
    title: 'Błąd połączenia',
    defaultMessage: 'Wystąpił problem z połączeniem internetowym'
  },
  [ErrorType.SERVER]: {
    title: 'Błąd serwera',
    defaultMessage: 'Wystąpił problem po stronie serwera'
  },
  [ErrorType.FILE_PROCESSING]: {
    title: 'Błąd przetwarzania pliku',
    defaultMessage: 'Nie udało się przetworzyć pliku'
  },
  [ErrorType.AUTHENTICATION]: {
    title: 'Błąd uwierzytelnienia',
    defaultMessage: 'Wymagane jest zalogowanie'
  },
  [ErrorType.PERMISSION]: {
    title: 'Brak uprawnień',
    defaultMessage: 'Nie masz uprawnień do tej operacji'
  },
  [ErrorType.NOT_FOUND]: {
    title: 'Nie znaleziono',
    defaultMessage: 'Żądany zasób nie został znaleziony'
  },
  [ErrorType.UNKNOWN]: {
    title: 'Nieoczekiwany błąd',
    defaultMessage: 'Wystąpił nieoczekiwany problem'
  }
}

/**
 * Create standardized error object
 */
export function createError(
  type: ErrorType,
  message?: string,
  details?: string,
  options?: {
    code?: string | number
    field?: string
    originalError?: unknown
  }
): AppError {
  return {
    type,
    message: message || ERROR_MESSAGES[type].defaultMessage,
    details,
    code: options?.code,
    field: options?.field,
    originalError: options?.originalError
  }
}

/**
 * Parse HTTP error response
 */
export async function parseHttpError(response: Response): Promise<AppError> {
  let message = ''
  let details = ''
  let type = ErrorType.SERVER

  try {
    const errorData = await response.json()
    message = errorData.error || errorData.message || ''
    details = errorData.details || ''
  } catch {
    // If JSON parsing fails, use status text
    message = response.statusText || 'HTTP Error'
  }

  // Determine error type based on status code
  switch (response.status) {
    case 400:
      type = ErrorType.VALIDATION
      break
    case 401:
      type = ErrorType.AUTHENTICATION
      break
    case 403:
      type = ErrorType.PERMISSION
      break
    case 404:
      type = ErrorType.NOT_FOUND
      break
    case 422:
      type = ErrorType.VALIDATION
      break
    case 500:
    case 502:
    case 503:
    case 504:
      type = ErrorType.SERVER
      break
    default:
      type = ErrorType.UNKNOWN
  }

  return createError(type, message, details, {
    code: response.status,
    originalError: response
  })
}

/**
 * Parse JavaScript error to AppError
 */
export function parseJavaScriptError(error: unknown): AppError {
  if (error instanceof TypeError || error instanceof ReferenceError) {
    return createError(ErrorType.UNKNOWN, 'Błąd aplikacji', undefined, {
      originalError: error
    })
  }

  if (error instanceof Error) {
    // Check for network errors
    if (error.message.includes('fetch') || error.message.includes('network')) {
      return createError(ErrorType.NETWORK, 'Błąd połączenia sieciowego', error.message, {
        originalError: error
      })
    }

    return createError(ErrorType.UNKNOWN, error.message, undefined, {
      originalError: error
    })
  }

  return createError(ErrorType.UNKNOWN, 'Nieznany błąd', String(error), {
    originalError: error
  })
}

/**
 * Show error toast notification
 */
export function showErrorToast(error: AppError): void {
  const config = ERROR_MESSAGES[error.type]
  
  toast({
    title: config.title,
    description: error.message,
    variant: 'destructive',
  })

  // Log detailed error information for debugging
  console.error(`[${error.type.toUpperCase()}]`, {
    message: error.message,
    details: error.details,
    code: error.code,
    field: error.field,
    originalError: error.originalError
  })
}

/**
 * Handle API response with automatic error handling
 */
export async function handleApiResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await parseHttpError(response)
    showErrorToast(error)
    throw error
  }

  try {
    return await response.json()
  } catch (parseError) {
    const error = createError(
      ErrorType.SERVER,
      'Nieprawidłowa odpowiedź serwera',
      'Nie udało się przetworzyć odpowiedzi JSON',
      { originalError: parseError }
    )
    showErrorToast(error)
    throw error
  }
}

/**
 * Handle async operations with automatic error handling
 */
export async function handleAsyncOperation<T>(
  operation: () => Promise<T>,
  customErrorMessage?: string
): Promise<T | null> {
  try {
    return await operation()
  } catch (error) {
    let appError: AppError

    if (error instanceof Response) {
      appError = await parseHttpError(error)
    } else if (error && typeof error === 'object' && 'type' in error) {
      appError = error as AppError
    } else {
      appError = parseJavaScriptError(error)
      if (customErrorMessage) {
        appError.message = customErrorMessage
      }
    }

    showErrorToast(appError)
    return null
  }
}

/**
 * Validate form data and return standardized errors
 */
export function validateForm<T extends Record<string, any>>(
  data: T,
  validators: Partial<Record<keyof T, (value: any) => string | null>>
): AppError[] {
  const errors: AppError[] = []

  for (const [field, validator] of Object.entries(validators)) {
    const value = data[field as keyof T]
    const validationError = validator(value)
    
    if (validationError) {
      errors.push(createError(
        ErrorType.VALIDATION,
        validationError,
        undefined,
        { field: field as string }
      ))
    }
  }

  return errors
}

/**
 * Show multiple validation errors
 */
export function showValidationErrors(errors: AppError[]): void {
  if (errors.length === 0) return

  if (errors.length === 1) {
    showErrorToast(errors[0])
    return
  }

  // Show summary for multiple errors
  const errorMessages = errors.map(e => `• ${e.field ? `${e.field}: ` : ''}${e.message}`).join('\n')
  
  toast({
    title: 'Błędy walidacji',
    description: errorMessages,
    variant: 'destructive',
  })
}

/**
 * Success toast helper
 */
export function showSuccessToast(message: string, title = 'Sukces'): void {
  toast({
    title,
    description: message,
  })
}