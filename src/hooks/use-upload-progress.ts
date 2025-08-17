import { useState, useCallback } from 'react'
import { handleApiResponse, showErrorToast, createError, ErrorType } from '@/lib/error-handler'

export interface UploadProgress {
  progress: number // 0-100
  status: 'idle' | 'uploading' | 'processing' | 'completed' | 'error'
  message?: string
  error?: string
}

export interface UseUploadProgressReturn {
  uploadProgress: UploadProgress
  uploadWithProgress: (
    url: string,
    formData: FormData,
    onComplete?: (response: any) => void
  ) => Promise<void>
  resetProgress: () => void
}

/**
 * Hook for tracking file upload progress with XMLHttpRequest
 */
export function useUploadProgress(): UseUploadProgressReturn {
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    progress: 0,
    status: 'idle'
  })

  const resetProgress = useCallback(() => {
    setUploadProgress({
      progress: 0,
      status: 'idle'
    })
  }, [])

  const uploadWithProgress = useCallback(async (
    url: string,
    formData: FormData,
    onComplete?: (response: any) => void
  ) => {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()

      // Reset progress
      setUploadProgress({
        progress: 0,
        status: 'uploading',
        message: 'Przesyłanie pliku...'
      })

      // Track upload progress
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100)
          setUploadProgress(prev => ({
            ...prev,
            progress,
            message: `Przesyłanie pliku... ${progress}%`
          }))
        }
      })

      // Handle upload completion
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setUploadProgress({
            progress: 100,
            status: 'processing',
            message: 'Przetwarzanie pliku...'
          })

          try {
            const response = JSON.parse(xhr.responseText)
            
            // Simulate processing time for better UX
            setTimeout(() => {
              setUploadProgress({
                progress: 100,
                status: 'completed',
                message: 'Plik został pomyślnie przetworzony!'
              })
              
              if (onComplete) {
                onComplete(response)
              }
              resolve()
            }, 500)
          } catch (error) {
            const appError = createError(
              ErrorType.SERVER,
              'Błąd podczas przetwarzania odpowiedzi serwera',
              undefined,
              { originalError: error }
            )
            setUploadProgress({
              progress: 100,
              status: 'error',
              error: appError.message
            })
            showErrorToast(appError)
            reject(appError)
          }
        } else {
          let errorMessage = `Błąd serwera: ${xhr.status}`
          
          try {
            const errorResponse = JSON.parse(xhr.responseText)
            errorMessage = errorResponse.error || errorMessage
          } catch {
            // Use default error message
          }

          const appError = createError(
            xhr.status >= 400 && xhr.status < 500 ? ErrorType.VALIDATION : ErrorType.SERVER,
            errorMessage,
            undefined,
            { code: xhr.status }
          )

          setUploadProgress({
            progress: 0,
            status: 'error',
            error: appError.message
          })
          showErrorToast(appError)
          reject(appError)
        }
      })

      // Handle network errors
      xhr.addEventListener('error', () => {
        const appError = createError(ErrorType.NETWORK, 'Błąd sieci podczas przesyłania pliku')
        setUploadProgress({
          progress: 0,
          status: 'error',
          error: appError.message
        })
        showErrorToast(appError)
        reject(appError)
      })

      // Handle upload abortion
      xhr.addEventListener('abort', () => {
        setUploadProgress({
          progress: 0,
          status: 'idle',
          message: 'Przesyłanie zostało anulowane'
        })
        reject(createError(ErrorType.UNKNOWN, 'Upload aborted'))
      })

      // Start upload
      xhr.open('POST', url)
      xhr.send(formData)
    })
  }, [])

  return {
    uploadProgress,
    uploadWithProgress,
    resetProgress
  }
}