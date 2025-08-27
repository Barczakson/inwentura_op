/**
 * Virtualized Data Table Performance Tests
 * 
 * Tests performance of large dataset rendering and virtualization
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { VirtualizedDataTable } from '@/components/virtualized-data-table'

// Mock react-virtual
jest.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: jest.fn((options) => ({
    getVirtualItems: jest.fn(() => {
      const count = options?.count || 3
      const itemsToShow = Math.min(count, 3) // Show max 3 items in tests
      return Array.from({ length: itemsToShow }, (_, i) => ({
        index: i,
        start: i * 60,
        size: 60,
        key: String(i),
      }))
    }),
    getTotalSize: jest.fn(() => (options?.count || 3) * 60),
    scrollToIndex: jest.fn(),
    measureElement: jest.fn(),
  })),
}))

// Mock Lucide React icons
jest.mock('lucide-react', () => ({
  Edit: () => <div data-testid="edit-icon">Edit</div>,
  Trash2: () => <div data-testid="trash-icon">Trash</div>,
  FileText: () => <div data-testid="file-icon">File</div>,
  ArrowUpDown: () => <div data-testid="arrow-icon">Arrow</div>,
  FileSpreadsheet: () => <div data-testid="file-spreadsheet-icon">FileSpreadsheet</div>,
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

// Helper to generate large datasets
const generateLargeDataset = (size: number) => {
  return Array.from({ length: size }, (_, i) => ({
    id: `item-${i}`,
    itemId: `A${String(i).padStart(4, '0')}`,
    name: `Product ${i}`,
    quantity: Math.floor(Math.random() * 1000) + 1,
    unit: i % 3 === 0 ? 'kg' : i % 3 === 1 ? 'l' : 'pcs',
    fileId: `file-${Math.floor(i / 100)}`,
    count: Math.floor(Math.random() * 5) + 1,
    sourceFiles: [`file-${Math.floor(i / 100)}.xlsx`],
    createdAt: new Date(Date.now() - Math.random() * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  }))
}

const generateUploadedFiles = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    id: `file-${i}`,
    name: `file-${i}.xlsx`,
    size: Math.floor(Math.random() * 1000000) + 100000,
    uploadDate: new Date(Date.now() - Math.random() * 86400000).toISOString(),
  }))
}

describe('Virtualized Data Table Performance Tests', () => {
  const mockOnEdit = jest.fn()
  const mockOnDelete = jest.fn()
  const mockOnStartInlineEdit = jest.fn()
  const mockOnCancelInlineEdit = jest.fn()
  const mockOnSaveInlineEdit = jest.fn()
  const mockOnInlineEditValueChange = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Rendering Performance', () => {
    it('should render small datasets quickly', () => {
      const data = generateLargeDataset(100)
      const uploadedFiles = generateUploadedFiles(5)
      
      const startTime = performance.now()
      
      render(
        <VirtualizedDataTable
          data={data}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          uploadedFiles={uploadedFiles}
          onStartInlineEdit={mockOnStartInlineEdit}
          onCancelInlineEdit={mockOnCancelInlineEdit}
          onSaveInlineEdit={mockOnSaveInlineEdit}
          inlineEditingItem={null}
          inlineEditValue=""
          onInlineEditValueChange={mockOnInlineEditValueChange}
        />
      )
      
      const endTime = performance.now()
      const renderTime = endTime - startTime
      
      expect(screen.getByRole('table')).toBeInTheDocument()
      expect(renderTime).toBeLessThan(100) // Should render in less than 100ms
    })

    it('should handle medium datasets efficiently', () => {
      const data = generateLargeDataset(1000)
      const uploadedFiles = generateUploadedFiles(10)
      
      const startTime = performance.now()
      
      render(
        <VirtualizedDataTable
          data={data}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          uploadedFiles={uploadedFiles}
          onStartInlineEdit={mockOnStartInlineEdit}
          onCancelInlineEdit={mockOnCancelInlineEdit}
          onSaveInlineEdit={mockOnSaveInlineEdit}
          inlineEditingItem={null}
          inlineEditValue=""
          onInlineEditValueChange={mockOnInlineEditValueChange}
        />
      )
      
      const endTime = performance.now()
      const renderTime = endTime - startTime
      
      expect(screen.getByRole('table')).toBeInTheDocument()
      expect(renderTime).toBeLessThan(200) // Should render in less than 200ms
    })

    it('should handle large datasets with virtualization', () => {
      const data = generateLargeDataset(10000)
      const uploadedFiles = generateUploadedFiles(50)
      
      const startTime = performance.now()
      
      render(
        <VirtualizedDataTable
          data={data}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          uploadedFiles={uploadedFiles}
          onStartInlineEdit={mockOnStartInlineEdit}
          onCancelInlineEdit={mockOnCancelInlineEdit}
          onSaveInlineEdit={mockOnSaveInlineEdit}
          inlineEditingItem={null}
          inlineEditValue=""
          onInlineEditValueChange={mockOnInlineEditValueChange}
        />
      )
      
      const endTime = performance.now()
      const renderTime = endTime - startTime
      
      expect(screen.getByRole('table')).toBeInTheDocument()
      // Even with 10k items, virtualization should keep render time reasonable
      expect(renderTime).toBeLessThan(500) // Should render in less than 500ms
    })

    it('should handle very large datasets without blocking', () => {
      const data = generateLargeDataset(50000)
      const uploadedFiles = generateUploadedFiles(100)
      
      const startTime = performance.now()
      
      render(
        <VirtualizedDataTable
          data={data}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          uploadedFiles={uploadedFiles}
          onStartInlineEdit={mockOnStartInlineEdit}
          onCancelInlineEdit={mockOnCancelInlineEdit}
          onSaveInlineEdit={mockOnSaveInlineEdit}
          inlineEditingItem={null}
          inlineEditValue=""
          onInlineEditValueChange={mockOnInlineEditValueChange}
        />
      )
      
      const endTime = performance.now()
      const renderTime = endTime - startTime
      
      expect(screen.getByRole('table')).toBeInTheDocument()
      // Even with 50k items, should not block the UI
      expect(renderTime).toBeLessThan(1000) // Should render in less than 1 second
    })
  })

  describe('Re-render Performance', () => {
    it('should handle data updates efficiently', () => {
      const initialData = generateLargeDataset(1000)
      const uploadedFiles = generateUploadedFiles(10)
      
      const { rerender } = render(
        <VirtualizedDataTable
          data={initialData}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          uploadedFiles={uploadedFiles}
          onStartInlineEdit={mockOnStartInlineEdit}
          onCancelInlineEdit={mockOnCancelInlineEdit}
          onSaveInlineEdit={mockOnSaveInlineEdit}
          inlineEditingItem={null}
          inlineEditValue=""
          onInlineEditValueChange={mockOnInlineEditValueChange}
        />
      )
      
      // Update data
      const updatedData = [...initialData]
      updatedData[0] = { ...updatedData[0], name: 'Updated Product' }
      
      const startTime = performance.now()
      
      rerender(
        <VirtualizedDataTable
          data={updatedData}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          uploadedFiles={uploadedFiles}
          onStartInlineEdit={mockOnStartInlineEdit}
          onCancelInlineEdit={mockOnCancelInlineEdit}
          onSaveInlineEdit={mockOnSaveInlineEdit}
          inlineEditingItem={null}
          inlineEditValue=""
          onInlineEditValueChange={mockOnInlineEditValueChange}
        />
      )
      
      const endTime = performance.now()
      const rerenderTime = endTime - startTime
      
      expect(rerenderTime).toBeLessThan(50) // Re-render should be very fast
    })

    it('should handle prop changes efficiently', () => {
      const data = generateLargeDataset(1000)
      const uploadedFiles = generateUploadedFiles(10)
      
      const { rerender } = render(
        <VirtualizedDataTable
          data={data}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          uploadedFiles={uploadedFiles}
          showAggregated={false}
          onStartInlineEdit={mockOnStartInlineEdit}
          onCancelInlineEdit={mockOnCancelInlineEdit}
          onSaveInlineEdit={mockOnSaveInlineEdit}
          inlineEditingItem={null}
          inlineEditValue=""
          onInlineEditValueChange={mockOnInlineEditValueChange}
        />
      )
      
      const startTime = performance.now()
      
      // Change showAggregated prop
      rerender(
        <VirtualizedDataTable
          data={data}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          uploadedFiles={uploadedFiles}
          showAggregated={true}
          onStartInlineEdit={mockOnStartInlineEdit}
          onCancelInlineEdit={mockOnCancelInlineEdit}
          onSaveInlineEdit={mockOnSaveInlineEdit}
          inlineEditingItem={null}
          inlineEditValue=""
          onInlineEditValueChange={mockOnInlineEditValueChange}
        />
      )
      
      const endTime = performance.now()
      const rerenderTime = endTime - startTime
      
      expect(rerenderTime).toBeLessThan(100) // Prop changes should be efficient
    })
  })

  describe('Memory Usage', () => {
    it('should not leak memory with large datasets', () => {
      const initialMemory = process.memoryUsage().heapUsed
      
      // Render and unmount multiple large tables
      for (let i = 0; i < 10; i++) {
        const data = generateLargeDataset(5000)
        const uploadedFiles = generateUploadedFiles(25)
        
        const { unmount } = render(
          <VirtualizedDataTable
            data={data}
            onEdit={mockOnEdit}
            onDelete={mockOnDelete}
            uploadedFiles={uploadedFiles}
            onStartInlineEdit={mockOnStartInlineEdit}
            onCancelInlineEdit={mockOnCancelInlineEdit}
            onSaveInlineEdit={mockOnSaveInlineEdit}
            inlineEditingItem={null}
            inlineEditValue=""
            onInlineEditValueChange={mockOnInlineEditValueChange}
          />
        )
        
        unmount()
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc()
        }
      }
      
      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = finalMemory - initialMemory
      
      // Memory increase should be minimal
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024) // Less than 50MB
    })

    it('should handle rapid data changes without memory leaks', () => {
      const uploadedFiles = generateUploadedFiles(10)
      let data = generateLargeDataset(1000)
      
      const { rerender } = render(
        <VirtualizedDataTable
          data={data}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          uploadedFiles={uploadedFiles}
          onStartInlineEdit={mockOnStartInlineEdit}
          onCancelInlineEdit={mockOnCancelInlineEdit}
          onSaveInlineEdit={mockOnSaveInlineEdit}
          inlineEditingItem={null}
          inlineEditValue=""
          onInlineEditValueChange={mockOnInlineEditValueChange}
        />
      )
      
      const initialMemory = process.memoryUsage().heapUsed
      
      // Rapidly change data 50 times
      for (let i = 0; i < 50; i++) {
        data = generateLargeDataset(1000)
        
        rerender(
          <VirtualizedDataTable
            data={data}
            onEdit={mockOnEdit}
            onDelete={mockOnDelete}
            uploadedFiles={uploadedFiles}
            onStartInlineEdit={mockOnStartInlineEdit}
            onCancelInlineEdit={mockOnCancelInlineEdit}
            onSaveInlineEdit={mockOnSaveInlineEdit}
            inlineEditingItem={null}
            inlineEditValue=""
            onInlineEditValueChange={mockOnInlineEditValueChange}
          />
        )
        
        if (i % 10 === 0 && global.gc) {
          global.gc()
        }
      }
      
      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = finalMemory - initialMemory
      
      // Memory should not grow significantly
      expect(memoryIncrease).toBeLessThan(30 * 1024 * 1024) // Less than 30MB
    })
  })

  describe('Interaction Performance', () => {
    it('should handle button clicks efficiently', () => {
      const data = generateLargeDataset(1000)
      const uploadedFiles = generateUploadedFiles(10)
      
      render(
        <VirtualizedDataTable
          data={data}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          uploadedFiles={uploadedFiles}
          onStartInlineEdit={mockOnStartInlineEdit}
          onCancelInlineEdit={mockOnCancelInlineEdit}
          onSaveInlineEdit={mockOnSaveInlineEdit}
          inlineEditingItem={null}
          inlineEditValue=""
          onInlineEditValueChange={mockOnInlineEditValueChange}
        />
      )
      
      const editButtons = screen.getAllByTestId('edit-icon')
      
      const startTime = performance.now()
      
      // Click multiple edit buttons
      for (let i = 0; i < Math.min(10, editButtons.length); i++) {
        fireEvent.click(editButtons[i])
      }
      
      const endTime = performance.now()
      const clickTime = endTime - startTime
      
      expect(clickTime).toBeLessThan(100) // All clicks should be processed quickly
      expect(mockOnEdit).toHaveBeenCalledTimes(Math.min(10, editButtons.length))
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty data efficiently', () => {
      const startTime = performance.now()
      
      render(
        <VirtualizedDataTable
          data={[]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          uploadedFiles={[]}
          onStartInlineEdit={mockOnStartInlineEdit}
          onCancelInlineEdit={mockOnCancelInlineEdit}
          onSaveInlineEdit={mockOnSaveInlineEdit}
          inlineEditingItem={null}
          inlineEditValue=""
          onInlineEditValueChange={mockOnInlineEditValueChange}
        />
      )
      
      const endTime = performance.now()
      const renderTime = endTime - startTime
      
      expect(screen.getByText('Brak danych do wyświetlenia')).toBeInTheDocument()
      expect(renderTime).toBeLessThan(20) // Empty state should render very quickly
    })

    it('should handle single item efficiently', () => {
      const data = [{
        id: 'item-0',
        itemId: 'A0000',
        name: 'Product 0',
        quantity: 1,
        unit: 'kg',
        fileId: 'file-0',
        count: 1,
        sourceFiles: ['file-0.xlsx'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }]
      const uploadedFiles = generateUploadedFiles(1)

      const startTime = performance.now()

      render(
        <VirtualizedDataTable
          data={data}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          uploadedFiles={uploadedFiles}
          onStartInlineEdit={mockOnStartInlineEdit}
          onCancelInlineEdit={mockOnCancelInlineEdit}
          onSaveInlineEdit={mockOnSaveInlineEdit}
          inlineEditingItem={null}
          inlineEditValue=""
          onInlineEditValueChange={mockOnInlineEditValueChange}
        />
      )

      const endTime = performance.now()
      const renderTime = endTime - startTime

      expect(screen.getByRole('table')).toBeInTheDocument()
      expect(renderTime).toBeLessThan(50) // Single item should render very quickly
    })
  })
})
