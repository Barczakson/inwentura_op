import React from 'react'
import { render, screen } from '@testing-library/react'
import { VirtualizedDataTable } from '@/components/virtualized-data-table'
import { formatQuantityWithConversion } from '@/lib/unit-conversion'

// Mock the formatQuantityWithConversion function
jest.mock('@/lib/unit-conversion', () => ({
  formatQuantityWithConversion: jest.fn((quantity, unit) => `${quantity} ${unit}`),
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

describe('VirtualizedDataTable Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(formatQuantityWithConversion as jest.Mock).mockImplementation(
      (quantity, unit) => `${quantity} ${unit}`
    )
  })

  it('renders the virtualized table with data', () => {
    render(<VirtualizedDataTable data={mockData} />)

    // Check that the container is rendered
    const container = screen.getByRole('table')
    expect(container).toBeInTheDocument()

    // Check that some data is rendered (virtualization makes it complex to check all)
    expect(screen.getByText('Product A')).toBeInTheDocument()
    expect(screen.getByText('10 kg')).toBeInTheDocument()
  })

  it('renders action buttons when callbacks are provided', () => {
    const mockOnEdit = jest.fn()
    const mockOnDelete = jest.fn()

    render(
      <VirtualizedDataTable 
        data={mockData} 
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    )

    const editButtons = screen.getAllByRole('button', { name: /edit/i })
    const deleteButtons = screen.getAllByRole('button', { name: /trash/i })

    expect(editButtons.length).toBeGreaterThan(0)
    expect(deleteButtons.length).toBeGreaterThan(0)
  })

  it('does not render action buttons when callbacks are not provided', () => {
    render(<VirtualizedDataTable data={mockData} />)

    const editButtons = screen.queryAllByRole('button', { name: /edit/i })
    const deleteButtons = screen.queryAllByRole('button', { name: /trash/i })

    expect(editButtons).toHaveLength(0)
    expect(deleteButtons).toHaveLength(0)
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

    render(<VirtualizedDataTable data={aggregatedData} showAggregated={true} />)

    expect(screen.getByText('Product A')).toBeInTheDocument()
    expect(screen.getByText('15 kg')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument() // Count column
  })

  it('shows empty state when no data', () => {
    render(<VirtualizedDataTable data={[]} />)

    expect(screen.getByText('Brak danych do wyświetlenia')).toBeInTheDocument()
  })

  it('handles inline editing', () => {
    const mockOnStartInlineEdit = jest.fn()

    render(
      <VirtualizedDataTable
        data={mockData}
        onStartInlineEdit={mockOnStartInlineEdit}
      />
    )

    // Find a quantity cell and click it to trigger inline edit
    const quantityCell = screen.getByText('10 kg').closest('div')
    if (quantityCell) {
      // Simulate click on quantity cell
      quantityCell.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      
      // Check if the onStartInlineEdit callback was called
      expect(mockOnStartInlineEdit).toHaveBeenCalledWith('1', 10)
    }
  })

  it('renders performance info', () => {
    render(<VirtualizedDataTable data={mockData} />)

    expect(screen.getByText(/Virtualizacja aktywna/)).toBeInTheDocument()
  })
})