import { renderHook, act } from '@testing-library/react'
import { useUploadProgress } from '../use-upload-progress'

// Mock the error handler
jest.mock('@/lib/error-handler', () => ({
  handleApiResponse: jest.fn(),
  showErrorToast: jest.fn(),
  createError: jest.fn((type, message, details, metadata) => ({
    type,
    message,
    details,
    metadata
  })),
  ErrorType: {
    NETWORK: 'NETWORK',
    SERVER: 'SERVER',
    VALIDATION: 'VALIDATION',
    UNKNOWN: 'UNKNOWN'
  }
}))

// Mock XMLHttpRequest
class MockXMLHttpRequest {
  public upload: any = {}
  public status = 200
  public responseText = ''
  public readyState = 4
  private listeners: { [key: string]: Array<(...args: any[]) => void> } = {}

  constructor() {
    this.upload.addEventListener = jest.fn((event: string, callback: (...args: any[]) => void) => {
      if (!this.upload.listeners) this.upload.listeners = {}
      if (!this.upload.listeners[event]) this.upload.listeners[event] = []
      this.upload.listeners[event].push(callback)
    })
  }

  addEventListener(event: string, callback: (...args: any[]) => void) {
    if (!this.listeners[event]) this.listeners[event] = []
    this.listeners[event].push(callback)
  }

  removeEventListener(event: string, callback: (...args: any[]) => void) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback)
    }
  }

  open(method: string, url: string) {
    // Mock implementation
  }

  send(data: any) {
    // Mock implementation - will be controlled in tests
  }

  abort() {
    this.triggerEvent('abort')
  }

  triggerEvent(event: string, data?: any) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data))
    }
  }

  triggerUploadProgress(loaded: number, total: number) {
    if (this.upload.listeners && this.upload.listeners['progress']) {
      this.upload.listeners['progress'].forEach((callback: (...args: any[]) => void) => 
        callback({ loaded, total, lengthComputable: true })
      )
    }
  }
}

describe('useUploadProgress Hook', () => {
  let mockXHR: MockXMLHttpRequest

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    
    mockXHR = new MockXMLHttpRequest()
    ;(global as any).XMLHttpRequest = jest.fn(() => mockXHR)
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it('should initialize with idle state', () => {
    const { result } = renderHook(() => useUploadProgress())

    expect(result.current.uploadProgress).toEqual({
      progress: 0,
      status: 'idle'
    })
  })

  it('should reset progress to idle state', () => {
    const { result } = renderHook(() => useUploadProgress())

    // First set some progress
    act(() => {
      result.current.uploadWithProgress('/api/upload', new FormData())
    })

    // Then reset
    act(() => {
      result.current.resetProgress()
    })

    expect(result.current.uploadProgress).toEqual({
      progress: 0,
      status: 'idle'
    })
  })

  it('should start upload with uploading status', () => {
    const { result } = renderHook(() => useUploadProgress())

    act(() => {
      result.current.uploadWithProgress('/api/upload', new FormData())
    })

    expect(result.current.uploadProgress).toEqual({
      progress: 0,
      status: 'uploading',
      message: 'Przesyłanie pliku...'
    })
  })

  it('should update progress during upload', () => {
    const { result } = renderHook(() => useUploadProgress())

    act(() => {
      result.current.uploadWithProgress('/api/upload', new FormData())
    })

    // Simulate upload progress
    act(() => {
      mockXHR.triggerUploadProgress(50, 100)
    })

    expect(result.current.uploadProgress).toEqual({
      progress: 50,
      status: 'uploading',
      message: 'Przesyłanie pliku... 50%'
    })

    // Simulate more progress
    act(() => {
      mockXHR.triggerUploadProgress(75, 100)
    })

    expect(result.current.uploadProgress).toEqual({
      progress: 75,
      status: 'uploading',
      message: 'Przesyłanie pliku... 75%'
    })
  })

  it('should handle successful upload completion', async () => {
    const { result } = renderHook(() => useUploadProgress())
    const mockOnComplete = jest.fn()
    const mockResponse = { success: true, data: 'test' }

    mockXHR.status = 200
    mockXHR.responseText = JSON.stringify(mockResponse)

    let uploadPromise: Promise<void>

    act(() => {
      uploadPromise = result.current.uploadWithProgress('/api/upload', new FormData(), mockOnComplete)
    })

    // Simulate upload completion
    act(() => {
      mockXHR.triggerEvent('load')
    })

    // Should be in processing state
    expect(result.current.uploadProgress).toEqual({
      progress: 100,
      status: 'processing',
      message: 'Przetwarzanie pliku...'
    })

    // Fast-forward the processing timeout
    act(() => {
      jest.advanceTimersByTime(500)
    })

    // Should be completed
    expect(result.current.uploadProgress).toEqual({
      progress: 100,
      status: 'completed',
      message: 'Plik został pomyślnie przetworzony!'
    })

    expect(mockOnComplete).toHaveBeenCalledWith(mockResponse)

    // Wait for promise to resolve
    await act(async () => {
      await uploadPromise
    })
  })

  it('should handle server errors', async () => {
    const { result } = renderHook(() => useUploadProgress())
    const { createError, showErrorToast } = jest.requireMock('@/lib/error-handler')

    mockXHR.status = 500
    mockXHR.responseText = JSON.stringify({ error: 'Server error' })

    let uploadPromise: Promise<void>

    act(() => {
      uploadPromise = result.current.uploadWithProgress('/api/upload', new FormData())
    })

    // Simulate server error
    act(() => {
      mockXHR.triggerEvent('load')
    })

    expect(result.current.uploadProgress.status).toBe('error')
    expect(createError).toHaveBeenCalled()
    expect(showErrorToast).toHaveBeenCalled()

    // Promise should reject
    await expect(uploadPromise).rejects.toBeDefined()
  })

  it('should handle network errors', async () => {
    const { result } = renderHook(() => useUploadProgress())
    const { createError, showErrorToast } = jest.requireMock('@/lib/error-handler')

    let uploadPromise: Promise<void>

    act(() => {
      uploadPromise = result.current.uploadWithProgress('/api/upload', new FormData())
    })

    // Simulate network error
    act(() => {
      mockXHR.triggerEvent('error')
    })

    expect(result.current.uploadProgress.status).toBe('error')
    expect(createError).toHaveBeenCalledWith(
      'NETWORK',
      'Błąd sieci podczas przesyłania pliku'
    )
    expect(showErrorToast).toHaveBeenCalled()

    // Promise should reject
    await expect(uploadPromise).rejects.toBeDefined()
  })

  it('should handle upload abortion', async () => {
    const { result } = renderHook(() => useUploadProgress())
    const { createError } = jest.requireMock('@/lib/error-handler')

    let uploadPromise: Promise<void>

    act(() => {
      uploadPromise = result.current.uploadWithProgress('/api/upload', new FormData())
    })

    // Simulate upload abortion
    act(() => {
      mockXHR.triggerEvent('abort')
    })

    expect(result.current.uploadProgress).toEqual({
      progress: 0,
      status: 'idle',
      message: 'Przesyłanie zostało anulowane'
    })

    expect(createError).toHaveBeenCalledWith('UNKNOWN', 'Upload aborted')

    // Promise should reject
    await expect(uploadPromise).rejects.toBeDefined()
  })

  it('should handle JSON parsing errors', async () => {
    const { result } = renderHook(() => useUploadProgress())
    const { createError, showErrorToast } = jest.requireMock('@/lib/error-handler')

    mockXHR.status = 200
    mockXHR.responseText = 'invalid json'

    let uploadPromise: Promise<void>

    act(() => {
      uploadPromise = result.current.uploadWithProgress('/api/upload', new FormData())
    })

    // Simulate successful response with invalid JSON
    act(() => {
      mockXHR.triggerEvent('load')
    })

    expect(result.current.uploadProgress.status).toBe('error')
    expect(createError).toHaveBeenCalledWith(
      'SERVER',
      'Błąd podczas przetwarzania odpowiedzi serwera',
      undefined,
      { originalError: expect.any(Error) }
    )
    expect(showErrorToast).toHaveBeenCalled()

    // Promise should reject
    await expect(uploadPromise).rejects.toBeDefined()
  })

  it('should handle client errors (4xx)', async () => {
    const { result } = renderHook(() => useUploadProgress())
    const { createError } = jest.requireMock('@/lib/error-handler')

    mockXHR.status = 400
    mockXHR.responseText = JSON.stringify({ error: 'Bad request' })

    let uploadPromise: Promise<void>

    act(() => {
      uploadPromise = result.current.uploadWithProgress('/api/upload', new FormData())
    })

    // Simulate client error
    act(() => {
      mockXHR.triggerEvent('load')
    })

    expect(result.current.uploadProgress.status).toBe('error')
    expect(createError).toHaveBeenCalledWith(
      'VALIDATION',
      'Bad request',
      undefined,
      { code: 400 }
    )

    // Promise should reject
    await expect(uploadPromise).rejects.toBeDefined()
  })

  it('should handle progress without lengthComputable', () => {
    const { result } = renderHook(() => useUploadProgress())

    act(() => {
      result.current.uploadWithProgress('/api/upload', new FormData())
    })

    // Simulate progress event without lengthComputable
    act(() => {
      if (mockXHR.upload.listeners && mockXHR.upload.listeners['progress']) {
        mockXHR.upload.listeners['progress'].forEach((callback: (...args: any[]) => void) => 
          callback({ loaded: 50, total: 100, lengthComputable: false })
        )
      }
    })

    // Progress should not update when lengthComputable is false
    expect(result.current.uploadProgress.progress).toBe(0)
  })

  it('should calculate progress correctly', () => {
    const { result } = renderHook(() => useUploadProgress())

    act(() => {
      result.current.uploadWithProgress('/api/upload', new FormData())
    })

    // Test various progress calculations
    act(() => {
      mockXHR.triggerUploadProgress(33, 100)
    })
    expect(result.current.uploadProgress.progress).toBe(33)

    act(() => {
      mockXHR.triggerUploadProgress(67, 100)
    })
    expect(result.current.uploadProgress.progress).toBe(67)

    act(() => {
      mockXHR.triggerUploadProgress(100, 100)
    })
    expect(result.current.uploadProgress.progress).toBe(100)

    // Test rounding
    act(() => {
      mockXHR.triggerUploadProgress(33, 99) // 33.33... should round to 33
    })
    expect(result.current.uploadProgress.progress).toBe(33)
  })

  it('should handle multiple concurrent uploads correctly', () => {
    const { result } = renderHook(() => useUploadProgress())

    // Start first upload
    act(() => {
      result.current.uploadWithProgress('/api/upload1', new FormData())
    })

    expect(result.current.uploadProgress.status).toBe('uploading')

    // Start second upload (should replace the first)
    act(() => {
      result.current.uploadWithProgress('/api/upload2', new FormData())
    })

    expect(result.current.uploadProgress.status).toBe('uploading')
    expect(result.current.uploadProgress.progress).toBe(0)
  })

  it('should maintain stable function references', () => {
    const { result, rerender } = renderHook(() => useUploadProgress())

    const initialFunctions = {
      uploadWithProgress: result.current.uploadWithProgress,
      resetProgress: result.current.resetProgress
    }

    // Trigger a re-render
    rerender()

    // Functions should be the same references (memoized)
    expect(result.current.uploadWithProgress).toBe(initialFunctions.uploadWithProgress)
    expect(result.current.resetProgress).toBe(initialFunctions.resetProgress)
  })
})
