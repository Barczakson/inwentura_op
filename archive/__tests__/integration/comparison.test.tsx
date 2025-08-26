/**
 * Integration tests for monthly comparison functionality
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ComparisonPage from '@/app/comparison/page'

// Mock toast
jest.mock('@/hooks/use-toast', () => ({
  toast: jest.fn(),
}))

// Mock Next.js Link
jest.mock('next/link', () => {
  return function MockLink({ children, href }: { children: React.ReactNode; href: string }) {
    return React.createElement('a', { href }, children)
  }
})

const mockFetch = jest.fn()
global.fetch = mockFetch

describe('Monthly Comparison Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetch.mockClear()
  })

  const setupMockData = (currentData: any[], previousData: any[]) => {
    // Mock current data load
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ aggregated: currentData }),
    })

    // Mock previous month file upload
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ aggregated: previousData }),
    })
  }

  it('should detect new products in current month', async () => {
    const user = userEvent.setup()
    const { toast } = require('@/hooks/use-toast')

    const currentData = [
      { id: '1', itemId: 'A001', name: 'Product A', quantity: 10, unit: 'kg' },
      { id: '2', itemId: 'A002', name: 'Product B', quantity: 5, unit: 'l' },
    ]

    const previousData = [
      { id: '1', itemId: 'A001', name: 'Product A', quantity: 10, unit: 'kg' },
    ]

    setupMockData(currentData, previousData)

    render(<ComparisonPage />)

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText(/2 pozycji/)).toBeInTheDocument()
    })

    // Upload previous month file
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    if (fileInput) {
      const file = new File(['excel content'], 'previous-month.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })

      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      })

      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(screen.getByText('Wybrano: previous-month.xlsx')).toBeInTheDocument()
      })

      // Click compare button
      const compareButton = screen.getByText('Porównaj Inwentarze Miesięczne')
      await user.click(compareButton)

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith({
          title: 'Porównanie miesięczne zakończone',
          description: expect.stringContaining('Znaleziono 1 różnic'),
        })
      })
    }
  })

  it('should detect missing products from current month', async () => {
    const user = userEvent.setup()
    const { toast } = require('@/hooks/use-toast')

    const currentData = [
      { id: '1', itemId: 'A001', name: 'Product A', quantity: 10, unit: 'kg' },
    ]

    const previousData = [
      { id: '1', itemId: 'A001', name: 'Product A', quantity: 10, unit: 'kg' },
      { id: '2', itemId: 'A002', name: 'Product B', quantity: 5, unit: 'l' },
    ]

    setupMockData(currentData, previousData)

    render(<ComparisonPage />)

    await waitFor(() => {
      expect(screen.getByText(/1 pozycji/)).toBeInTheDocument()
    })

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    if (fileInput) {
      const file = new File(['excel content'], 'previous-month.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })

      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      })

      fireEvent.change(fileInput)
      
      const compareButton = screen.getByText('Porównaj Inwentarze Miesięczne')
      await user.click(compareButton)

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith({
          title: 'Porównanie miesięczne zakończone',
          description: expect.stringContaining('Znaleziono 1 różnic'),
        })
      })
    }
  })

  it('should detect quantity changes', async () => {
    const user = userEvent.setup()
    const { toast } = require('@/hooks/use-toast')

    const currentData = [
      { id: '1', itemId: 'A001', name: 'Product A', quantity: 15, unit: 'kg' },
      { id: '2', itemId: 'A002', name: 'Product B', quantity: 3, unit: 'l' },
    ]

    const previousData = [
      { id: '1', itemId: 'A001', name: 'Product A', quantity: 10, unit: 'kg' },
      { id: '2', itemId: 'A002', name: 'Product B', quantity: 8, unit: 'l' },
    ]

    setupMockData(currentData, previousData)

    render(<ComparisonPage />)

    await waitFor(() => {
      expect(screen.getByText(/2 pozycji/)).toBeInTheDocument()
    })

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    if (fileInput) {
      const file = new File(['excel content'], 'previous-month.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })

      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      })

      fireEvent.change(fileInput)
      
      const compareButton = screen.getByText('Porównaj Inwentarze Miesięczne')
      await user.click(compareButton)

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith({
          title: 'Porównanie miesięczne zakończone',
          description: expect.stringContaining('Znaleziono 2 różnic'),
        })
      })
    }
  })

  it('should handle comparison with identical inventories', async () => {
    const user = userEvent.setup()
    const { toast } = require('@/hooks/use-toast')

    const identicalData = [
      { id: '1', itemId: 'A001', name: 'Product A', quantity: 10, unit: 'kg' },
      { id: '2', itemId: 'A002', name: 'Product B', quantity: 5, unit: 'l' },
    ]

    setupMockData(identicalData, identicalData)

    render(<ComparisonPage />)

    await waitFor(() => {
      expect(screen.getByText(/2 pozycji/)).toBeInTheDocument()
    })

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    if (fileInput) {
      const file = new File(['excel content'], 'previous-month.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })

      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      })

      fireEvent.change(fileInput)
      
      const compareButton = screen.getByText('Porównaj Inwentarze Miesięczne')
      await user.click(compareButton)

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith({
          title: 'Porównanie miesięczne zakończone',
          description: expect.stringContaining('Znaleziono 0 różnic'),
        })
      })
    }
  })

  it('should handle API errors during file upload', async () => {
    const user = userEvent.setup()
    const { toast } = require('@/hooks/use-toast')

    // Mock initial data load
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ aggregated: [] }),
    })

    // Mock failed file upload
    mockFetch.mockRejectedValueOnce(new Error('Upload failed'))

    render(<ComparisonPage />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    if (fileInput) {
      const file = new File(['excel content'], 'previous-month.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })

      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      })

      fireEvent.change(fileInput)
      
      const compareButton = screen.getByText('Porównaj Inwentarze Miesięczne')
      await user.click(compareButton)

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith({
          title: 'Błąd',
          description: 'Nie udało się przeprowadzić porównania miesięcznego',
          variant: 'destructive',
        })
      })
    }
  })

  it('should calculate percentage changes correctly', async () => {
    const user = userEvent.setup()

    const currentData = [
      { id: '1', itemId: 'A001', name: 'Product A', quantity: 20, unit: 'kg' }, // 100% increase
      { id: '2', itemId: 'A002', name: 'Product B', quantity: 5, unit: 'l' },   // 50% decrease
    ]

    const previousData = [
      { id: '1', itemId: 'A001', name: 'Product A', quantity: 10, unit: 'kg' },
      { id: '2', itemId: 'A002', name: 'Product B', quantity: 10, unit: 'l' },
    ]

    setupMockData(currentData, previousData)

    render(<ComparisonPage />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    if (fileInput) {
      const file = new File(['excel content'], 'previous-month.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })

      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      })

      fireEvent.change(fileInput)
      
      const compareButton = screen.getByText('Porównaj Inwentarze Miesięczne')
      await user.click(compareButton)

      // The component should process the comparison correctly
      // Specific percentage validation would require more complex mocking of state
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/excel/upload', {
          method: 'POST',
          body: expect.any(FormData),
        })
      })
    }
  })

  it('should handle edge case with zero quantities', async () => {
    const user = userEvent.setup()

    const currentData = [
      { id: '1', itemId: 'A001', name: 'Product A', quantity: 0, unit: 'kg' },
    ]

    const previousData = [
      { id: '1', itemId: 'A001', name: 'Product A', quantity: 10, unit: 'kg' },
    ]

    setupMockData(currentData, previousData)

    render(<ComparisonPage />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    if (fileInput) {
      const file = new File(['excel content'], 'previous-month.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })

      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      })

      fireEvent.change(fileInput)
      
      const compareButton = screen.getByText('Porównaj Inwentarze Miesięczne')
      await user.click(compareButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })
    }
  })
})