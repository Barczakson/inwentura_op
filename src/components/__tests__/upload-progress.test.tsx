import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import { UploadProgressComponent } from '../upload-progress'
import { UploadProgress } from '@/hooks/use-upload-progress'

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  CheckCircle: ({ className }: any) => <div data-testid="check-circle" className={className} />,
  XCircle: ({ className }: any) => <div data-testid="x-circle" className={className} />,
  Upload: ({ className }: any) => <div data-testid="upload" className={className} />,
  Loader2: ({ className }: any) => <div data-testid="loader2" className={className} />,
  X: ({ className }: any) => <div data-testid="x" className={className} />,
}))

const mockOnCancel = jest.fn()
const mockOnClose = jest.fn()

describe('UploadProgressComponent', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('does not render when status is idle', () => {
    const progress: UploadProgress = {
      progress: 0,
      status: 'idle'
    }

    const { container } = render(
      <UploadProgressComponent progress={progress} />
    )

    expect(container.firstChild).toBeNull()
  })

  it('renders uploading state correctly', () => {
    const progress: UploadProgress = {
      progress: 45,
      status: 'uploading',
      message: 'Przesyłanie pliku... 45%'
    }

    render(
      <UploadProgressComponent 
        progress={progress} 
        fileName="test.xlsx"
        onCancel={mockOnCancel}
      />
    )

    expect(screen.getByText('test.xlsx')).toBeInTheDocument()
    expect(screen.getByText('Przesyłanie pliku... 45%')).toBeInTheDocument()
    expect(screen.getByTestId('loader2')).toBeInTheDocument()
    expect(screen.getByText('45%')).toBeInTheDocument()
    expect(screen.getByText('Przesyłanie...')).toBeInTheDocument()
    expect(screen.getByText('Anuluj')).toBeInTheDocument()
  })

  it('renders processing state correctly', () => {
    const progress: UploadProgress = {
      progress: 100,
      status: 'processing',
      message: 'Przetwarzanie pliku...'
    }

    render(
      <UploadProgressComponent 
        progress={progress} 
        fileName="test.xlsx"
        onCancel={mockOnCancel}
      />
    )

    expect(screen.getByText('test.xlsx')).toBeInTheDocument()
    expect(screen.getByText('Przetwarzanie pliku...')).toBeInTheDocument()
    expect(screen.getByTestId('loader2')).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()
    expect(screen.getByText('Przetwarzanie...')).toBeInTheDocument()
    expect(screen.getByText('Anuluj')).toBeInTheDocument()
  })

  it('renders completed state correctly', () => {
    const progress: UploadProgress = {
      progress: 100,
      status: 'completed',
      message: 'Plik został pomyślnie przetworzony!'
    }

    render(
      <UploadProgressComponent 
        progress={progress} 
        fileName="test.xlsx"
        onClose={mockOnClose}
      />
    )

    expect(screen.getByText('test.xlsx')).toBeInTheDocument()
    expect(screen.getByText('Plik został pomyślnie przetworzony!')).toBeInTheDocument()
    expect(screen.getByTestId('check-circle')).toBeInTheDocument()
    expect(screen.getByText('Plik został pomyślnie przesłany i przetworzony!')).toBeInTheDocument()
    expect(screen.getByTestId('x')).toBeInTheDocument() // Close button
    expect(screen.queryByText('Anuluj')).not.toBeInTheDocument()
  })

  it('renders error state correctly', () => {
    const progress: UploadProgress = {
      progress: 0,
      status: 'error',
      error: 'Błąd podczas przesyłania pliku'
    }

    render(
      <UploadProgressComponent 
        progress={progress} 
        fileName="test.xlsx"
        onClose={mockOnClose}
      />
    )

    expect(screen.getByText('test.xlsx')).toBeInTheDocument()
    expect(screen.getByText('Błąd podczas przesyłania pliku')).toBeInTheDocument()
    expect(screen.getByTestId('x-circle')).toBeInTheDocument()
    expect(screen.getByTestId('x')).toBeInTheDocument() // Close button
    expect(screen.queryByText('Anuluj')).not.toBeInTheDocument()
  })

  it('calls onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup()
    const progress: UploadProgress = {
      progress: 50,
      status: 'uploading'
    }

    render(
      <UploadProgressComponent 
        progress={progress} 
        onCancel={mockOnCancel}
      />
    )

    const cancelButton = screen.getByText('Anuluj')
    await user.click(cancelButton)

    expect(mockOnCancel).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup()
    const progress: UploadProgress = {
      progress: 100,
      status: 'completed'
    }

    render(
      <UploadProgressComponent 
        progress={progress} 
        onClose={mockOnClose}
      />
    )

    const closeButton = screen.getByTestId('x')
    await user.click(closeButton)

    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('shows default file name when fileName is not provided', () => {
    const progress: UploadProgress = {
      progress: 25,
      status: 'uploading'
    }

    render(
      <UploadProgressComponent progress={progress} />
    )

    expect(screen.getByText('Przesyłanie pliku')).toBeInTheDocument()
  })

  it('shows default status text when no message is provided', () => {
    const progress: UploadProgress = {
      progress: 75,
      status: 'uploading'
    }

    render(
      <UploadProgressComponent progress={progress} />
    )

    expect(screen.getByText('Przesyłanie... 75%')).toBeInTheDocument()
  })

  it('prioritizes error message over default status text', () => {
    const progress: UploadProgress = {
      progress: 0,
      status: 'error',
      error: 'Custom error message'
    }

    render(
      <UploadProgressComponent progress={progress} />
    )

    expect(screen.getByText('Custom error message')).toBeInTheDocument()
    expect(screen.queryByText('Wystąpił błąd podczas przesyłania')).not.toBeInTheDocument()
  })

  it('prioritizes custom message over default status text', () => {
    const progress: UploadProgress = {
      progress: 50,
      status: 'uploading',
      message: 'Custom upload message'
    }

    render(
      <UploadProgressComponent progress={progress} />
    )

    expect(screen.getByText('Custom upload message')).toBeInTheDocument()
    expect(screen.queryByText('Przesyłanie... 50%')).not.toBeInTheDocument()
  })

  it('does not show progress bar for completed status', () => {
    const progress: UploadProgress = {
      progress: 100,
      status: 'completed'
    }

    render(
      <UploadProgressComponent progress={progress} />
    )

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('does not show progress bar for error status', () => {
    const progress: UploadProgress = {
      progress: 0,
      status: 'error'
    }

    render(
      <UploadProgressComponent progress={progress} />
    )

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('shows progress bar for uploading and processing status', () => {
    const uploadingProgress: UploadProgress = {
      progress: 50,
      status: 'uploading'
    }

    const { rerender } = render(
      <UploadProgressComponent progress={uploadingProgress} />
    )

    expect(screen.getByRole('progressbar')).toBeInTheDocument()

    const processingProgress: UploadProgress = {
      progress: 100,
      status: 'processing'
    }

    rerender(<UploadProgressComponent progress={processingProgress} />)

    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('does not show close button when onClose is not provided', () => {
    const progress: UploadProgress = {
      progress: 100,
      status: 'completed'
    }

    render(
      <UploadProgressComponent progress={progress} />
    )

    expect(screen.queryByTestId('x')).not.toBeInTheDocument()
  })

  it('does not show cancel button when onCancel is not provided', () => {
    const progress: UploadProgress = {
      progress: 50,
      status: 'uploading'
    }

    render(
      <UploadProgressComponent progress={progress} />
    )

    expect(screen.queryByText('Anuluj')).not.toBeInTheDocument()
  })

  it('shows custom success message when provided', () => {
    const progress: UploadProgress = {
      progress: 100,
      status: 'completed',
      message: 'Custom success message'
    }

    render(
      <UploadProgressComponent progress={progress} />
    )

    expect(screen.getByText('Custom success message')).toBeInTheDocument()
  })
})
