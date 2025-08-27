import {
  ErrorType,
  createError,
  parseHttpError,
  parseJavaScriptError,
  showErrorToast,
  handleApiResponse,
  handleAsyncOperation,
  validateForm,
  showValidationErrors,
  showSuccessToast
} from '../error-handler'

// Mock the toast hook
const mockToast = jest.fn()
jest.mock('@/hooks/use-toast', () => ({
  toast: mockToast
}))

// Mock console.error to avoid noise in tests
const mockConsoleError = jest.fn()
global.console.error = mockConsoleError

describe('Error Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockToast.mockClear()
    mockConsoleError.mockClear()
  })

  describe('createError', () => {
    it('should create error with default message', () => {
      const error = createError(ErrorType.VALIDATION)

      expect(error).toEqual({
        type: ErrorType.VALIDATION,
        message: 'Wprowadzone dane są nieprawidłowe',
        details: undefined,
        code: undefined,
        field: undefined,
        originalError: undefined
      })
    })

    it('should create error with custom message', () => {
      const error = createError(ErrorType.NETWORK, 'Custom network error')

      expect(error).toEqual({
        type: ErrorType.NETWORK,
        message: 'Custom network error',
        details: undefined,
        code: undefined,
        field: undefined,
        originalError: undefined
      })
    })

    it('should create error with all options', () => {
      const originalError = new Error('Original')
      const error = createError(
        ErrorType.SERVER,
        'Server error',
        'Detailed description',
        {
          code: 500,
          field: 'username',
          originalError
        }
      )

      expect(error).toEqual({
        type: ErrorType.SERVER,
        message: 'Server error',
        details: 'Detailed description',
        code: 500,
        field: 'username',
        originalError
      })
    })
  })

  describe('parseHttpError', () => {
    it('should parse 400 error as validation', async () => {
      const mockResponse = {
        status: 400,
        json: jest.fn().mockResolvedValue({ error: 'Bad request' })
      } as any

      const error = await parseHttpError(mockResponse)

      expect(error.type).toBe(ErrorType.VALIDATION)
      expect(error.message).toBe('Bad request')
      expect(error.code).toBe(400)
    })

    it('should parse 401 error as authentication', async () => {
      const mockResponse = {
        status: 401,
        json: jest.fn().mockResolvedValue({ error: 'Unauthorized' })
      } as any

      const error = await parseHttpError(mockResponse)

      expect(error.type).toBe(ErrorType.AUTHENTICATION)
      expect(error.message).toBe('Unauthorized')
    })

    it('should parse 403 error as permission', async () => {
      const mockResponse = {
        status: 403,
        json: jest.fn().mockResolvedValue({ error: 'Forbidden' })
      } as any

      const error = await parseHttpError(mockResponse)

      expect(error.type).toBe(ErrorType.PERMISSION)
      expect(error.message).toBe('Forbidden')
    })

    it('should parse 404 error as not found', async () => {
      const mockResponse = {
        status: 404,
        json: jest.fn().mockResolvedValue({ error: 'Not found' })
      } as any

      const error = await parseHttpError(mockResponse)

      expect(error.type).toBe(ErrorType.NOT_FOUND)
      expect(error.message).toBe('Not found')
    })

    it('should parse 422 error as validation', async () => {
      const mockResponse = {
        status: 422,
        json: jest.fn().mockResolvedValue({ error: 'Unprocessable entity' })
      } as any

      const error = await parseHttpError(mockResponse)

      expect(error.type).toBe(ErrorType.VALIDATION)
      expect(error.message).toBe('Unprocessable entity')
    })

    it('should parse 500 error as server', async () => {
      const mockResponse = {
        status: 500,
        json: jest.fn().mockResolvedValue({ error: 'Internal server error' })
      } as any

      const error = await parseHttpError(mockResponse)

      expect(error.type).toBe(ErrorType.SERVER)
      expect(error.message).toBe('Internal server error')
    })

    it('should handle unknown status codes', async () => {
      const mockResponse = {
        status: 418,
        json: jest.fn().mockResolvedValue({ error: "I'm a teapot" })
      } as any

      const error = await parseHttpError(mockResponse)

      expect(error.type).toBe(ErrorType.UNKNOWN)
      expect(error.message).toBe("I'm a teapot")
    })

    it('should handle JSON parsing errors', async () => {
      const mockResponse = {
        status: 500,
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON'))
      } as any

      const error = await parseHttpError(mockResponse)

      expect(error.type).toBe(ErrorType.SERVER)
      expect(error.message).toBe('Wystąpił problem po stronie serwera')
    })

    it('should use default message when no error in response', async () => {
      const mockResponse = {
        status: 400,
        json: jest.fn().mockResolvedValue({})
      } as any

      const error = await parseHttpError(mockResponse)

      expect(error.type).toBe(ErrorType.VALIDATION)
      expect(error.message).toBe('Wprowadzone dane są nieprawidłowe')
    })
  })

  describe('parseJavaScriptError', () => {
    it('should parse TypeError', () => {
      const jsError = new TypeError('Type error')
      const error = parseJavaScriptError(jsError)

      expect(error.type).toBe(ErrorType.UNKNOWN)
      expect(error.message).toBe('Błąd aplikacji')
      expect(error.originalError).toBe(jsError)
    })

    it('should parse ReferenceError', () => {
      const jsError = new ReferenceError('Reference error')
      const error = parseJavaScriptError(jsError)

      expect(error.type).toBe(ErrorType.UNKNOWN)
      expect(error.message).toBe('Błąd aplikacji')
      expect(error.originalError).toBe(jsError)
    })

    it('should parse network errors', () => {
      const jsError = new Error('fetch failed')
      const error = parseJavaScriptError(jsError)

      expect(error.type).toBe(ErrorType.NETWORK)
      expect(error.message).toBe('Błąd połączenia sieciowego')
      expect(error.details).toBe('fetch failed')
    })

    it('should parse generic Error', () => {
      const jsError = new Error('Generic error')
      const error = parseJavaScriptError(jsError)

      expect(error.type).toBe(ErrorType.UNKNOWN)
      expect(error.message).toBe('Generic error')
      expect(error.originalError).toBe(jsError)
    })

    it('should handle non-Error objects', () => {
      const error = parseJavaScriptError('string error')

      expect(error.type).toBe(ErrorType.UNKNOWN)
      expect(error.message).toBe('Nieznany błąd')
      expect(error.details).toBe('string error')
    })

    it('should handle null/undefined', () => {
      const error = parseJavaScriptError(null)

      expect(error.type).toBe(ErrorType.UNKNOWN)
      expect(error.message).toBe('Nieznany błąd')
      expect(error.details).toBe('null')
    })
  })

  describe('showErrorToast', () => {
    it('should show error toast with correct configuration', () => {
      const error = createError(ErrorType.VALIDATION, 'Test validation error')
      
      showErrorToast(error)

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Błąd walidacji',
        description: 'Test validation error',
        variant: 'destructive'
      })

      expect(mockConsoleError).toHaveBeenCalledWith(
        '[VALIDATION]',
        expect.objectContaining({
          message: 'Test validation error',
          details: undefined,
          code: undefined,
          field: undefined,
          originalError: undefined
        })
      )
    })

    it('should handle invalid error type', () => {
      const error = { type: 'invalid_type' as any, message: 'Test error' }
      
      showErrorToast(error as any)

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Nieoczekiwany błąd',
        description: 'Test error',
        variant: 'destructive'
      })
    })

    it('should provide default message for missing message', () => {
      const error = { type: ErrorType.NETWORK } as any
      
      showErrorToast(error)

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Błąd połączenia',
        description: 'An unknown error occurred',
        variant: 'destructive'
      })
    })
  })

  describe('handleApiResponse', () => {
    it('should return parsed JSON for successful response', async () => {
      const mockData = { success: true, data: 'test' }
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue(mockData)
      } as any

      const result = await handleApiResponse(mockResponse)

      expect(result).toEqual(mockData)
    })

    it('should throw error for failed response', async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValue({ error: 'Bad request' })
      } as any

      await expect(handleApiResponse(mockResponse)).rejects.toMatchObject({
        type: ErrorType.VALIDATION,
        message: 'Bad request'
      })

      expect(mockToast).toHaveBeenCalled()
    })

    it('should handle JSON parsing errors', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON'))
      } as any

      await expect(handleApiResponse(mockResponse)).rejects.toMatchObject({
        type: ErrorType.SERVER,
        message: 'Nieprawidłowa odpowiedź serwera'
      })

      expect(mockToast).toHaveBeenCalled()
    })
  })

  describe('handleAsyncOperation', () => {
    it('should return result for successful operation', async () => {
      const operation = jest.fn().mockResolvedValue('success')
      
      const result = await handleAsyncOperation(operation)

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalled()
    })

    it('should handle Response errors', async () => {
      const mockResponse = {
        status: 500,
        json: jest.fn().mockResolvedValue({ error: 'Server error' })
      } as any

      const operation = jest.fn().mockRejectedValue(mockResponse)
      
      const result = await handleAsyncOperation(operation)

      expect(result).toBeNull()
      expect(mockToast).toHaveBeenCalled()
    })

    it('should handle AppError objects', async () => {
      const appError = createError(ErrorType.VALIDATION, 'Validation failed')
      const operation = jest.fn().mockRejectedValue(appError)
      
      const result = await handleAsyncOperation(operation)

      expect(result).toBeNull()
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Błąd walidacji',
        description: 'Validation failed',
        variant: 'destructive'
      })
    })

    it('should handle JavaScript errors with custom message', async () => {
      const jsError = new Error('JS error')
      const operation = jest.fn().mockRejectedValue(jsError)
      
      const result = await handleAsyncOperation(operation, 'Custom error message')

      expect(result).toBeNull()
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Custom error message'
        })
      )
    })
  })

  describe('validateForm', () => {
    it('should return empty array for valid data', () => {
      const data = { name: 'John', age: 25 }
      const validators = {
        name: (value: string) => value ? null : 'Name is required',
        age: (value: number) => value > 0 ? null : 'Age must be positive'
      }

      const errors = validateForm(data, validators)

      expect(errors).toEqual([])
    })

    it('should return validation errors', () => {
      const data = { name: '', age: -1 }
      const validators = {
        name: (value: string) => value ? null : 'Name is required',
        age: (value: number) => value > 0 ? null : 'Age must be positive'
      }

      const errors = validateForm(data, validators)

      expect(errors).toHaveLength(2)
      expect(errors[0]).toMatchObject({
        type: ErrorType.VALIDATION,
        message: 'Name is required',
        field: 'name'
      })
      expect(errors[1]).toMatchObject({
        type: ErrorType.VALIDATION,
        message: 'Age must be positive',
        field: 'age'
      })
    })

    it('should handle missing validators', () => {
      const data = { name: 'John', age: 25 }
      const validators = {
        name: (value: string) => value ? null : 'Name is required'
        // age validator is missing
      }

      const errors = validateForm(data, validators)

      expect(errors).toEqual([])
    })
  })

  describe('showValidationErrors', () => {
    it('should not show toast for empty errors', () => {
      showValidationErrors([])

      expect(mockToast).not.toHaveBeenCalled()
    })

    it('should show single error toast', () => {
      const error = createError(ErrorType.VALIDATION, 'Single error', undefined, { field: 'name' })
      
      showValidationErrors([error])

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Błąd walidacji',
        description: 'Single error',
        variant: 'destructive'
      })
    })

    it('should show summary for multiple errors', () => {
      const errors = [
        createError(ErrorType.VALIDATION, 'Name error', undefined, { field: 'name' }),
        createError(ErrorType.VALIDATION, 'Age error', undefined, { field: 'age' })
      ]
      
      showValidationErrors(errors)

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Błędy walidacji',
        description: '• name: Name error\n• age: Age error',
        variant: 'destructive'
      })
    })

    it('should handle errors without field names', () => {
      const errors = [
        createError(ErrorType.VALIDATION, 'General error 1'),
        createError(ErrorType.VALIDATION, 'General error 2')
      ]
      
      showValidationErrors(errors)

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Błędy walidacji',
        description: '• General error 1\n• General error 2',
        variant: 'destructive'
      })
    })
  })

  describe('showSuccessToast', () => {
    it('should show success toast with default title', () => {
      showSuccessToast('Operation successful')

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Sukces',
        description: 'Operation successful'
      })
    })

    it('should show success toast with custom title', () => {
      showSuccessToast('File uploaded', 'Upload Complete')

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Upload Complete',
        description: 'File uploaded'
      })
    })
  })
})
