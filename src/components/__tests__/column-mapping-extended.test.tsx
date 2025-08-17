import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ColumnMapping } from '@/components/column-mapping'
import * as XLSX from 'xlsx'

// Mock XLSX
jest.mock('xlsx', () => ({
  read: jest.fn(),
  utils: {
    sheet_to_json: jest.fn(),
  },
}))

const mockXLSX = XLSX as jest.Mocked<typeof XLSX>

const mockFile = new File(['test content'], 'test.xlsx', {
  type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
})

const mockOnMappingComplete = jest.fn()
const mockOnCancel = jest.fn()

describe('ColumnMapping Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock XLSX functions for all tests
    mockXLSX.read.mockReturnValue({
      SheetNames: ['Sheet1'],
      Sheets: {
        Sheet1: {},
      },
    } as any)
    
    mockXLSX.utils.sheet_to_json.mockReturnValue([
      ['L.p.', 'Nr indeksu', 'Nazwa towaru', 'Ilość', 'JMZ'],
      [1, 'A001', 'Product A', 10, 'kg'],
      [2, 'A002', 'Product B', 5, 'l'],
    ])
  })

  it('renders column mapping interface', async () => {
    render(
      <ColumnMapping 
        file={mockFile} 
        onMappingComplete={mockOnMappingComplete}
        onCancel={mockOnCancel}
      />
    )

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByText('Map Excel Columns')).toBeInTheDocument()
    })

    expect(screen.getByText('Select which columns in your Excel file contain the required data.')).toBeInTheDocument()
    expect(screen.getByText('Header Row')).toBeInTheDocument()
    expect(screen.getByText('Item ID (Optional)')).toBeInTheDocument()
    expect(screen.getByText('Name *')).toBeInTheDocument()
    expect(screen.getByText('Quantity *')).toBeInTheDocument()
    expect(screen.getByText('Unit *')).toBeInTheDocument()
  })

  it('shows loading state while analyzing file', () => {
    // Make the analysis take longer by not resolving immediately
    mockXLSX.utils.sheet_to_json.mockImplementation(() => {
      // This will make the component show loading state
      return []
    })

    render(
      <ColumnMapping 
        file={mockFile} 
        onMappingComplete={mockOnMappingComplete}
        onCancel={mockOnCancel}
      />
    )

    expect(screen.getByText('Analyzing Excel file structure...')).toBeInTheDocument()
  })

  it('handles file analysis error', async () => {
    mockXLSX.read.mockImplementation(() => {
      throw new Error('Invalid Excel file')
    })

    render(
      <ColumnMapping 
        file={mockFile} 
        onMappingComplete={mockOnMappingComplete}
        onCancel={mockOnCancel}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Failed to analyze Excel file structure. Please try again.')).toBeInTheDocument()
    })
  })

  it('calls onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup()
    
    render(
      <ColumnMapping 
        file={mockFile} 
        onMappingComplete={mockOnMappingComplete}
        onCancel={mockOnCancel}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Cancel'))
    expect(mockOnCancel).toHaveBeenCalled()
  })

  it('shows validation error when required fields are not selected', async () => {
    const user = userEvent.setup()
    
    render(
      <ColumnMapping 
        file={mockFile} 
        onMappingComplete={mockOnMappingComplete}
        onCancel={mockOnCancel}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Apply Mapping and Process')).toBeInTheDocument()
    })

    // Try to submit without selecting required fields
    await user.click(screen.getByText('Apply Mapping and Process'))
    
    await waitFor(() => {
      expect(screen.getByText('Please select all required columns (Name, Quantity, and Unit)')).toBeInTheDocument()
    })
    
    expect(mockOnMappingComplete).not.toHaveBeenCalled()
  })

  it('calls onMappingComplete with correct mapping when form is submitted', async () => {
    const user = userEvent.setup()
    
    render(
      <ColumnMapping 
        file={mockFile} 
        onMappingComplete={mockOnMappingComplete}
        onCancel={mockOnCancel}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Apply Mapping and Process')).toBeInTheDocument()
    })

    // Select required columns
    await user.click(screen.getByText('Column 3 (Product A, Product B)'))
    await user.click(screen.getByText('Column 3 (Product A, Product B)')) // Name column
    
    await user.click(screen.getByText('Column 4 (10, 5)'))
    await user.click(screen.getByText('Column 4 (10, 5)')) // Quantity column
    
    await user.click(screen.getByText('Column 5 (kg, l)'))
    await user.click(screen.getByText('Column 5 (kg, l)')) // Unit column

    // Submit the form
    await user.click(screen.getByText('Apply Mapping and Process'))
    
    expect(mockOnMappingComplete).toHaveBeenCalledWith({
      itemIdColumn: undefined, // Not selected
      nameColumn: 2,           // Column 3 (0-indexed)
      quantityColumn: 3,       // Column 4 (0-indexed)
      unitColumn: 4,           // Column 5 (0-indexed)
      headerRow: 0             // Default header row
    })
  })

  it('allows selecting item ID column', async () => {
    const user = userEvent.setup()
    
    render(
      <ColumnMapping 
        file={mockFile} 
        onMappingComplete={mockOnMappingComplete}
        onCancel={mockOnCancel}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Apply Mapping and Process')).toBeInTheDocument()
    })

    // Select item ID column
    await user.click(screen.getByText('Column 2 (A001, A002)'))
    await user.click(screen.getByText('Column 2 (A001, A002)')) // Item ID column
    
    // Select required columns
    await user.click(screen.getByText('Column 3 (Product A, Product B)'))
    await user.click(screen.getByText('Column 3 (Product A, Product B)')) // Name column
    
    await user.click(screen.getByText('Column 4 (10, 5)'))
    await user.click(screen.getByText('Column 4 (10, 5)')) // Quantity column
    
    await user.click(screen.getByText('Column 5 (kg, l)'))
    await user.click(screen.getByText('Column 5 (kg, l)')) // Unit column

    // Submit the form
    await user.click(screen.getByText('Apply Mapping and Process'))
    
    expect(mockOnMappingComplete).toHaveBeenCalledWith({
      itemIdColumn: 1,         // Column 2 (0-indexed)
      nameColumn: 2,           // Column 3 (0-indexed)
      quantityColumn: 3,       // Column 4 (0-indexed)
      unitColumn: 4,           // Column 5 (0-indexed)
      headerRow: 0             // Default header row
    })
  })

  it('allows changing header row', async () => {
    const user = userEvent.setup()
    
    // Mock data with header row on second row
    mockXLSX.utils.sheet_to_json.mockReturnValue([
      ['Data Row 1', 'Data Row 1', 'Data Row 1', 'Data Row 1', 'Data Row 1'],
      ['L.p.', 'Nr indeksu', 'Nazwa towaru', 'Ilość', 'JMZ'],
      [1, 'A001', 'Product A', 10, 'kg'],
      [2, 'A002', 'Product B', 5, 'l'],
    ])
    
    render(
      <ColumnMapping 
        file={mockFile} 
        onMappingComplete={mockOnMappingComplete}
        onCancel={mockOnCancel}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Apply Mapping and Process')).toBeInTheDocument()
    })

    // Change header row to 1 (second row, 0-indexed)
    const headerRowSelect = screen.getByRole('combobox', { name: /header row/i })
    await user.click(headerRowSelect)
    await user.click(screen.getByText('Row 2'))

    // Select required columns
    await user.click(screen.getByText('Column 3 (Product A, Product B)'))
    await user.click(screen.getByText('Column 3 (Product A, Product B)')) // Name column
    
    await user.click(screen.getByText('Column 4 (10, 5)'))
    await user.click(screen.getByText('Column 4 (10, 5)')) // Quantity column
    
    await user.click(screen.getByText('Column 5 (kg, l)'))
    await user.click(screen.getByText('Column 5 (kg, l)')) // Unit column

    // Submit the form
    await user.click(screen.getByText('Apply Mapping and Process'))
    
    expect(mockOnMappingComplete).toHaveBeenCalledWith({
      itemIdColumn: undefined, // Not selected
      nameColumn: 2,           // Column 3 (0-indexed)
      quantityColumn: 3,       // Column 4 (0-indexed)
      unitColumn: 4,           // Column 5 (0-indexed)
      headerRow: 1             // Changed header row
    })
  })

  it('shows column preview values correctly', async () => {
    render(
      <ColumnMapping 
        file={mockFile} 
        onMappingComplete={mockOnMappingComplete}
        onCancel={mockOnCancel}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Column 1 (1, 2)')).toBeInTheDocument()
      expect(screen.getByText('Column 2 (A001, A002)')).toBeInTheDocument()
      expect(screen.getByText('Column 3 (Product A, Product B)')).toBeInTheDocument()
      expect(screen.getByText('Column 4 (10, 5)')).toBeInTheDocument()
      expect(screen.getByText('Column 5 (kg, l)')).toBeInTheDocument()
    })
  })

  it('handles files with inconsistent row lengths', async () => {
    // Mock data with inconsistent row lengths
    mockXLSX.utils.sheet_to_json.mockReturnValue([
      ['L.p.', 'Nr indeksu', 'Nazwa towaru', 'Ilość', 'JMZ'],
      [1, 'A001', 'Product A', 10], // Missing JMZ column
      [2, 'A002', 'Product B', 5, 'l'],
    ])
    
    render(
      <ColumnMapping 
        file={mockFile} 
        onMappingComplete={mockOnMappingComplete}
        onCancel={mockOnCancel}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Column 1 (1, 2)')).toBeInTheDocument()
      expect(screen.getByText('Column 2 (A001, A002)')).toBeInTheDocument()
      expect(screen.getByText('Column 3 (Product A, Product B)')).toBeInTheDocument()
      expect(screen.getByText('Column 4 (10, 5)')).toBeInTheDocument()
      // Should show empty value for missing data
      expect(screen.getByText('Column 5 (, l)')).toBeInTheDocument()
    })
  })
})