'use client'

import { Progress } from '@/components/ui/progress'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle, XCircle, Upload, Loader2, X } from 'lucide-react'
import { UploadProgress } from '@/hooks/use-upload-progress'

interface UploadProgressComponentProps {
  progress: UploadProgress
  fileName?: string
  onCancel?: () => void
  onClose?: () => void
}

export function UploadProgressComponent({ 
  progress, 
  fileName, 
  onCancel, 
  onClose 
}: UploadProgressComponentProps) {
  const getStatusIcon = () => {
    switch (progress.status) {
      case 'uploading':
      case 'processing':
        return <Loader2 className="w-5 h-5 animate-spin text-primary" />
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />
      default:
        return <Upload className="w-5 h-5 text-muted-foreground" />
    }
  }

  const getStatusColor = () => {
    switch (progress.status) {
      case 'uploading':
        return 'bg-blue-500'
      case 'processing':
        return 'bg-yellow-500'
      case 'completed':
        return 'bg-green-500'
      case 'error':
        return 'bg-red-500'
      default:
        return 'bg-muted'
    }
  }

  const getStatusText = () => {
    if (progress.error) return progress.error
    if (progress.message) return progress.message
    
    switch (progress.status) {
      case 'uploading':
        return `Przesyłanie... ${progress.progress}%`
      case 'processing':
        return 'Przetwarzanie pliku...'
      case 'completed':
        return 'Plik został pomyślnie przetworzony!'
      case 'error':
        return 'Wystąpił błąd podczas przesyłania'
      default:
        return 'Gotowy do przesłania'
    }
  }

  if (progress.status === 'idle') {
    return null
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getStatusIcon()}
              <div>
                <p className="font-medium text-sm">
                  {fileName || 'Przesyłanie pliku'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {getStatusText()}
                </p>
              </div>
            </div>
            
            {/* Close button */}
            {(progress.status === 'completed' || progress.status === 'error') && onClose && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Progress bar */}
          {(progress.status === 'uploading' || progress.status === 'processing') && (
            <div className="space-y-2">
              <Progress 
                value={progress.progress} 
                className="w-full"
                // Custom color based on status
                style={{
                  '--progress-background': getStatusColor()
                } as any}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{progress.progress}%</span>
                <span>
                  {progress.status === 'processing' ? 'Przetwarzanie...' : 'Przesyłanie...'}
                </span>
              </div>
            </div>
          )}

          {/* Error message */}
          {progress.status === 'error' && progress.error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{progress.error}</p>
            </div>
          )}

          {/* Success message */}
          {progress.status === 'completed' && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-700">
                {progress.message || 'Plik został pomyślnie przesłany i przetworzony!'}
              </p>
            </div>
          )}

          {/* Cancel button */}
          {(progress.status === 'uploading' || progress.status === 'processing') && onCancel && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={onCancel}
              >
                Anuluj
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}