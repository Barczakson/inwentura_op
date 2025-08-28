/**
 * End-to-End UI Workflow Tests
 * 
 * Tests complete user interface workflows and interactions
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Home from '@/app/page'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
  }),
}))

// Mock API calls
global.fetch = jest.fn()

// Mock file reading
const mockFileReader = {
  readAsArrayBuffer: jest.fn(),
  result: null,
  onload: null,
  onerror: null,
}

Object.defineProperty(global, 'FileReader', {
  writable: true,
  value: jest.fn(() => mockFileReader),
})

// Mock Lucide React icons
jest.mock('lucide-react', () => ({
  Upload: () => <div data-testid="upload-icon">Upload</div>,
  Download: () => <div data-testid="download-icon">Download</div>,
  Edit: () => <div data-testid="edit-icon">Edit</div>,
  Trash2: () => <div data-testid="trash-icon">Trash</div>,
  FileText: () => <div data-testid="file-icon">File</div>,
  Plus: () => <div data-testid="plus-icon">Plus</div>,
  X: () => <div data-testid="x-icon">X</div>,
  Check: () => <div data-testid="check-icon">Check</div>,
  AlertCircle: () => <div data-testid="alert-icon">Alert</div>,
  FileSpreadsheet: () => <div data-testid="file-spreadsheet-icon">FileSpreadsheet</div>,
  ArrowUpDown: () => <div data-testid="arrow-icon">Arrow</div>,
}))

// Mock unit conversion
jest.mock('@/lib/unit-conversion', () => ({
  formatQuantityWithConversion: jest.fn((quantity, unit) => `${quantity} ${unit}`),
}))

// Mock colors utility
jest.mock('@/lib/colors', () => ({
  abbreviateFileName: jest.fn((name) => name),
  getFileColorClass: jest.fn(() => 'text-blue-600'),
  getFileBackgroundColor: jest.fn(() => 'bg-blue-50'),
  getFileBorderColor: jest.fn(() => 'border-l-blue-500'),
  getFileInlineStyle: jest.fn(() => ({})),
}))

// Mock react-virtual
jest.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: jest.fn(() => ({
    getVirtualItems: jest.fn(() => [
      { index: 0, start: 0, size: 60, key: '0' },
      { index: 1, start: 60, size: 60, key: '1' },
      { index: 2, start: 120, size: 60, key: '2' },
    ]),
    getTotalSize: jest.fn(() => 180),
    scrollToIndex: jest.fn(),
    measureElement: jest.fn(),
  })),
}))

// Helper to create mock files
const createMockFile = (name: string, size: number, type: string = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') => {
  return new File(['mock content'], name, { type })
}

describe('End-to-End UI Workflow Tests', () => {
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
  const user = userEvent.setup()

  beforeEach(() => {
    jest.clearAllMocks()
    mockFetch.mockClear()
  })

  describe('File Upload Workflow', () => {
    it('should complete full file upload workflow', async () => {
      // Mock successful API responses
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            structure: {
              headers: ['Nr indeksu', 'Nazwa towaru', 'Ilość', 'Jednostka'],
              sampleData: [['A001', 'Steel Rod', '1500', 'kg']],
              estimatedDataRows: 1
            }
          })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            detection: {
              mapping: { itemId: 0, name: 1, quantity: 2, unit: 3 },
              confidence: 95
            }
          })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            fileId: 'file-1',
            rowCount: 1
          })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([
            {
              id: 'item-1',
              itemId: 'A001',
              name: 'Steel Rod',
              quantity: 1500,
              unit: 'kg',
              count: 1,
              sourceFiles: ['test.xlsx']
            }
          ])
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([])
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([])
        } as Response)

      render(<Home />)

      // Wait for component to mount
      await waitFor(() => {
        expect(screen.getByText('Manager Inwentury Excel')).toBeInTheDocument()
      })

      // Find file input
      const fileInput = screen.getByLabelText(/przeciągnij i upuść/i)
      expect(fileInput).toBeInTheDocument()

      // Create and upload file
      const file = createMockFile('test.xlsx', 1024)
      
      // Simulate file selection
      await user.upload(fileInput, file)

      // Wait for file to be processed
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/excel/preview', expect.any(Object))
      }, { timeout: 5000 })

      // Verify upload button appears and click it
      await waitFor(() => {
        const uploadButton = screen.getByRole('button', { name: /prześlij plik/i })
        expect(uploadButton).toBeInTheDocument()
      })

      const uploadButton = screen.getByRole('button', { name: /prześlij plik/i })
      await user.click(uploadButton)

      // Wait for upload to complete
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/excel/upload', expect.any(Object))
      }, { timeout: 5000 })

      // Verify data appears in the table
      await waitFor(() => {
        expect(screen.getByText('Steel Rod')).toBeInTheDocument()
      }, { timeout: 5000 })

      expect(screen.getByText('A001')).toBeInTheDocument()
      expect(screen.getByText('1500 kg')).toBeInTheDocument()
    })

    it('should handle file upload errors gracefully', async () => {
      // Mock failed upload
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            structure: {
              headers: ['Name', 'Quantity', 'Unit'],
              sampleData: [['Product', '100', 'kg']],
              estimatedDataRows: 1
            }
          })
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({
            error: 'Upload failed'
          })
        } as Response)

      render(<Home />)

      await waitFor(() => {
        expect(screen.getByText('Manager Inwentury Excel')).toBeInTheDocument()
      })

      const fileInput = screen.getByLabelText(/przeciągnij i upuść/i)
      const file = createMockFile('test.xlsx', 1024)
      
      await user.upload(fileInput, file)

      await waitFor(() => {
        const uploadButton = screen.getByRole('button', { name: /prześlij plik/i })
        expect(uploadButton).toBeInTheDocument()
      })

      const uploadButton = screen.getByRole('button', { name: /prześlij plik/i })
      await user.click(uploadButton)

      // Verify error message appears
      await waitFor(() => {
        expect(screen.getByText(/błąd podczas przesyłania/i)).toBeInTheDocument()
      }, { timeout: 5000 })
    })
  })

  describe('Manual Entry Workflow', () => {
    it('should complete manual data entry workflow', async () => {
      // Mock successful manual entry
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            item: {
              id: 'manual-1',
              itemId: 'M001',
              name: 'Manual Product',
              quantity: 50,
              unit: 'kg',
              count: 1
            }
          })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([
            {
              id: 'manual-1',
              itemId: 'M001',
              name: 'Manual Product',
              quantity: 50,
              unit: 'kg',
              count: 1,
              sourceFiles: []
            }
          ])
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([])
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([])
        } as Response)

      render(<Home />)

      await waitFor(() => {
        expect(screen.getByText('Manager Inwentury Excel')).toBeInTheDocument()
      })

      // Find and click manual entry button
      const manualButton = screen.getByRole('button', { name: /dodaj ręcznie/i })
      await user.click(manualButton)

      // Fill in the form
      const nameInput = screen.getByLabelText(/nazwa towaru/i)
      const quantityInput = screen.getByLabelText(/ilość/i)
      const unitInput = screen.getByLabelText(/jednostka/i)
      const itemIdInput = screen.getByLabelText(/nr indeksu/i)

      await user.type(nameInput, 'Manual Product')
      await user.type(quantityInput, '50')
      await user.type(unitInput, 'kg')
      await user.type(itemIdInput, 'M001')

      // Submit the form
      const submitButton = screen.getByRole('button', { name: /dodaj/i })
      await user.click(submitButton)

      // Wait for the item to appear
      await waitFor(() => {
        expect(screen.getByText('Manual Product')).toBeInTheDocument()
      }, { timeout: 5000 })

      expect(screen.getByText('M001')).toBeInTheDocument()
      expect(screen.getByText('50 kg')).toBeInTheDocument()
    })
  })

  describe('Data Export Workflow', () => {
    it('should complete data export workflow', async () => {
      // Mock data and export
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([
            {
              id: 'item-1',
              itemId: 'A001',
              name: 'Test Product',
              quantity: 100,
              unit: 'kg',
              count: 1,
              sourceFiles: ['test.xlsx']
            }
          ])
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([])
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([])
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          blob: () => Promise.resolve(new Blob(['mock excel data'], { 
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
          })),
          headers: new Map([
            ['content-disposition', 'attachment; filename="export.xlsx"']
          ])
        } as Response)

      // Mock URL.createObjectURL
      global.URL.createObjectURL = jest.fn(() => 'mock-url')
      global.URL.revokeObjectURL = jest.fn()

      // Mock document.createElement and click
      const mockLink = {
        href: '',
        download: '',
        click: jest.fn(),
      }
      jest.spyOn(document, 'createElement').mockReturnValue(mockLink as any)

      render(<Home />)

      await waitFor(() => {
        expect(screen.getByText('Manager Inwentury Excel')).toBeInTheDocument()
      })

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText('Test Product')).toBeInTheDocument()
      }, { timeout: 5000 })

      // Find and click export button
      const exportButton = screen.getByRole('button', { name: /eksportuj do excel/i })
      await user.click(exportButton)

      // Wait for export to complete
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/excel/export?type=aggregated', expect.any(Object))
      }, { timeout: 5000 })

      // Verify download was triggered
      expect(mockLink.click).toHaveBeenCalled()
      expect(global.URL.createObjectURL).toHaveBeenCalled()
    })
  })

  describe('Data View Switching Workflow', () => {
    it('should switch between aggregated and raw data views', async () => {
      // Mock data for both views
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([
            {
              id: 'agg-1',
              itemId: 'A001',
              name: 'Aggregated Product',
              quantity: 200,
              unit: 'kg',
              count: 2,
              sourceFiles: ['file1.xlsx', 'file2.xlsx']
            }
          ])
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([
            {
              id: 'raw-1',
              itemId: 'A001',
              name: 'Raw Product 1',
              quantity: 100,
              unit: 'kg',
              fileId: 'file-1'
            },
            {
              id: 'raw-2',
              itemId: 'A001',
              name: 'Raw Product 2',
              quantity: 100,
              unit: 'kg',
              fileId: 'file-2'
            }
          ])
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([
            { id: 'file-1', name: 'file1.xlsx', size: 1024, uploadDate: new Date().toISOString() },
            { id: 'file-2', name: 'file2.xlsx', size: 2048, uploadDate: new Date().toISOString() }
          ])
        } as Response)

      render(<Home />)

      await waitFor(() => {
        expect(screen.getByText('Manager Inwentury Excel')).toBeInTheDocument()
      })

      // Wait for aggregated data to load
      await waitFor(() => {
        expect(screen.getByText('Aggregated Product')).toBeInTheDocument()
      }, { timeout: 5000 })

      // Switch to raw data view
      const rawDataTab = screen.getByRole('tab', { name: /dane surowe/i })
      await user.click(rawDataTab)

      // Wait for raw data to load
      await waitFor(() => {
        expect(screen.getByText('Raw Product 1')).toBeInTheDocument()
      }, { timeout: 5000 })

      expect(screen.getByText('Raw Product 2')).toBeInTheDocument()

      // Switch back to aggregated view
      const aggregatedTab = screen.getByRole('tab', { name: /dane zagregowane/i })
      await user.click(aggregatedTab)

      // Verify aggregated data is shown again
      await waitFor(() => {
        expect(screen.getByText('Aggregated Product')).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling Workflows', () => {
    it('should handle network errors gracefully', async () => {
      // Mock network error
      mockFetch.mockRejectedValue(new Error('Network error'))

      render(<Home />)

      await waitFor(() => {
        expect(screen.getByText('Manager Inwentury Excel')).toBeInTheDocument()
      })

      // Wait for error state
      await waitFor(() => {
        expect(screen.getByText(/błąd podczas ładowania/i)).toBeInTheDocument()
      }, { timeout: 5000 })
    })

    it('should handle large file upload warnings', async () => {
      render(<Home />)

      await waitFor(() => {
        expect(screen.getByText('Manager Inwentury Excel')).toBeInTheDocument()
      })

      const fileInput = screen.getByLabelText(/przeciągnij i upuść/i)
      
      // Create large file (over 10MB)
      const largeFile = createMockFile('large.xlsx', 15 * 1024 * 1024)
      
      await user.upload(fileInput, largeFile)

      // Verify size warning appears
      await waitFor(() => {
        expect(screen.getByText(/plik jest za duży/i)).toBeInTheDocument()
      })
    })
  })
})
