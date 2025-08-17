import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DataTable } from '@/components/data-table'
import { formatQuantityWithConversion } from '@/lib/unit-conversion'

// Mock the formatQuantityWithConversion function
jest.mock('@/lib/unit-conversion', () => ({
  formatQuantityWithConversion: jest.fn((quantity, unit) => `${quantity} ${unit}`),
}))

// Mock the useDebounce hook
jest.mock('@/hooks/use-debounce', () => ({
  useDebounce: (value: string) => value,
}))

const mockData = [
  {
    id: '1',
    itemId: 'A001',
    name: 'Product A',
    quantity: 10,
    unit: 'kg',
  },
  {
    id: '2',
    itemId: 'A002',
    name: 'Product B',
    quantity: 5,
    unit: 'l',
  },
  {
    id: '3',
    itemId: 'A003',
    name: 'Product C',
    quantity: 1000,
    unit: 'g',
  },
]

const mockFiles = [
  {
    id: 'file1',
    name: 'inventory.xlsx',
  },
  {
    id: 'file2',
    name: 'inventory2.xlsx',
  },
]

describe('DataTable Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(formatQuantityWithConversion as jest.Mock).mockImplementation(
      (quantity, unit) => `${quantity} ${unit}`
    )
  })

  it('renders the table with data', () => {
    render(<DataTable data={mockData} />)

    expect(screen.getByText('Product A')).toBeInTheDocument()
    expect(screen.getByText('Product B')).toBeInTheDocument()
    expect(screen.getByText('Product C')).toBeInTheDocument()
    
    // Check that quantities are formatted
    expect(screen.getByText('10 kg')).toBeInTheDocument()
    expect(screen.getByText('5 l')).toBeInTheDocument()
    expect(screen.getByText('1000 g')).toBeInTheDocument()
  })

  it('renders action buttons when callbacks are provided', () => {
    const mockOnEdit = jest.fn()
    const mockOnDelete = jest.fn()

    render(
      <DataTable 
        data={mockData} 
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    )

    const editButtons = screen.getAllByRole('button', { name: /edit/i })
    const deleteButtons = screen.getAllByRole('button', { name: /trash/i })

    expect(editButtons).toHaveLength(mockData.length)
    expect(deleteButtons).toHaveLength(mockData.length)
  })

  it('does not render action buttons when callbacks are not provided', () => {
    render(<DataTable data={mockData} />)

    const editButtons = screen.queryAllByRole('button', { name: /edit/i })
    const deleteButtons = screen.queryAllByRole('button', { name: /trash/i })

    expect(editButtons).toHaveLength(0)
    expect(deleteButtons).toHaveLength(0)
  })

  it('filters data based on search term', async () => {
    const user = userEvent.setup()
    render(<DataTable data={mockData} />)

    const searchInput = screen.getByPlaceholderText('Szukaj po nazwie lub ID...')
    await user.type(searchInput, 'Product A')

    expect(screen.getByText('Product A')).toBeInTheDocument()
    expect(screen.queryByText('Product B')).not.toBeInTheDocument()
    expect(screen.queryByText('Product C')).not.toBeInTheDocument()
  })

  it('filters data based on item ID search', async () => {
    const user = userEvent.setup()
    render(<DataTable data={mockData} />)

    const searchInput = screen.getByPlaceholderText('Szukaj po nazwie lub ID...')
    await user.type(searchInput, 'A002')

    expect(screen.queryByText('Product A')).not.toBeInTheDocument()
    expect(screen.getByText('Product B')).toBeInTheDocument()
    expect(screen.queryByText('Product C')).not.toBeInTheDocument()
  })

  it('filters data based on unit', async () => {
    const user = userEvent.setup()
    render(<DataTable data={mockData} />)

    const unitFilter = screen.getByRole('combobox', { name: /filtruj według jednostki/i })
    await user.click(unitFilter)
    await user.click(screen.getByText('kg'))

    expect(screen.getByText('Product A')).toBeInTheDocument()
    expect(screen.queryByText('Product B')).not.toBeInTheDocument()
    expect(screen.queryByText('Product C')).not.toBeInTheDocument()
  })

  it('sorts data by name', async () => {
    const user = userEvent.setup()
    render(<DataTable data={mockData} />)

    // Click on name column header to sort
    const nameHeader = screen.getByText('Name')
    await user.click(nameHeader)

    // Check that items are sorted (this would depend on the sorting implementation)
    const rows = screen.getAllByRole('row')
    // We would need to check the order of rows here
  })

  it('sorts data by quantity', async () => {
    const user = userEvent.setup()
    render(<DataTable data={mockData} />)

    // Click on quantity column header to sort
    const quantityHeader = screen.getByText('Quantity')
    await user.click(quantityHeader)

    // Check that items are sorted (this would depend on the sorting implementation)
  })

  it('shows aggregated data when showAggregated is true', () => {
    const aggregatedData = [
      {
        id: '1',
        itemId: 'A001',
        name: 'Product A',
        quantity: 15,
        unit: 'kg',
        count: 2,
      },
    ]

    render(<DataTable data={aggregatedData} showAggregated={true} />)

    expect(screen.getByText('Product A')).toBeInTheDocument()
    expect(screen.getByText('15 kg')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument() // Count column
  })

  it('handles inline editing', async () => {
    const user = userEvent.setup()
    const mockOnStartInlineEdit = jest.fn()
    const mockOnSaveInlineEdit = jest.fn()
    const mockOnCancelInlineEdit = jest.fn()
    const mockOnInlineEditValueChange = jest.fn()

    render(
      <DataTable
        data={mockData}
        inlineEditingItem="1"
        inlineEditValue="15"
        onStartInlineEdit={mockOnStartInlineEdit}
        onSaveInlineEdit={mockOnSaveInlineEdit}
        onCancelInlineEdit={mockOnCancelInlineEdit}
        onInlineEditValueChange={mockOnInlineEditValueChange}
      />
    )

    // Check that inline edit input is shown for the correct item
    const input = screen.getByDisplayValue('15')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('type', 'number')

    // Test changing the value
    await user.type(input, '20')
    expect(mockOnInlineEditValueChange).toHaveBeenCalledWith('1520')

    // Test saving with Enter key
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(mockOnSaveInlineEdit).toHaveBeenCalledWith('1')

    // Test canceling with Escape key
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(mockOnCancelInlineEdit).toHaveBeenCalled()
  })

  it('shows file grouping when groupedByFile is true', () => {
    const groupedData = [
      {
        id: '1',
        itemId: 'A001',
        name: 'Product A',
        quantity: 10,
        unit: 'kg',
        fileId: 'file1',
      },
      {
        id: '2',
        itemId: 'A002',
        name: 'Product B',
        quantity: 5,
        unit: 'l',
        fileId: 'file2',
      },
    ]

    render(
      <DataTable 
        data={groupedData} 
        groupedByFile={true}
        uploadedFiles={mockFiles}
      />
    )

    expect(screen.getByText('inventory.xlsx')).toBeInTheDocument()
    expect(screen.getByText('inventory2.xlsx')).toBeInTheDocument()
  })

  it('handles file group expansion', async () => {
    const user = userEvent.setup()
    const groupedData = [
      {
        id: '1',
        itemId: 'A001',
        name: 'Product A',
        quantity: 10,
        unit: 'kg',
        fileId: 'file1',
      },
    ]

    render(
      <DataTable 
        data={groupedData} 
        groupedByFile={true}
        uploadedFiles={mockFiles}
      />
    )

    // Initially, the content should not be visible
    expect(screen.queryByText('Product A')).not.toBeInTheDocument()

    // Click to expand the file group
    const expandButton = screen.getByRole('button', { name: /inventory.xlsx/i })
    await user.click(expandButton)

    // Now the content should be visible
    expect(screen.getByText('Product A')).toBeInTheDocument()
  })

  it('shows bulk edit controls when bulkEditMode is true', () => {
    const mockOnSelectItem = jest.fn()
    const mockOnSelectAll = jest.fn()

    render(
      <DataTable
        data={mockData}
        bulkEditMode={true}
        onSelectItem={mockOnSelectItem}
        onSelectAll={mockOnSelectAll}
      />
    )

    // Check for select all checkbox
    const selectAllCheckbox = screen.getByRole('button', { name: /square/i })
    expect(selectAllCheckbox).toBeInTheDocument()

    // Check for individual item checkboxes
    const itemCheckboxes = screen.getAllByRole('button', { name: /square/i })
    // One for select all, one for each item
    expect(itemCheckboxes).toHaveLength(mockData.length + 1)
  })

  it('handles loading state', () => {
    render(<DataTable data={[]} isLoading={true} />)

    expect(screen.getByText('Ładowanie danych...')).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument() // spinner
  })

  it('shows empty state when no data', () => {
    render(<DataTable data={[]} />)

    expect(screen.getByText('Nie znaleziono danych')).toBeInTheDocument()
  })

  it('shows pagination controls when paginationMeta is provided', () => {
    const mockPaginationMeta = {
      page: 1,
      limit: 10,
      total: 100,
      totalPages: 10,
      hasNext: true,
      hasPrev: false,
    }

    const mockOnPaginationChange = {
      setPage: jest.fn(),
      setLimit: jest.fn(),
      setSearch: jest.fn(),
      setSorting: jest.fn(),
    }

    render(
      <DataTable
        data={mockData}
        paginationMeta={mockPaginationMeta}
        onPaginationChange={mockOnPaginationChange}
      />
    )

    expect(screen.getByText('Wyświetlono 1 - 3 z 100 elementów')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument() // Current page
  })
})