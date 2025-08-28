import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import { EditItemDialog } from '../edit-item-dialog'

// Mock the unit conversion module
jest.mock('@/lib/unit-conversion', () => ({
  getUnitsByCategory: jest.fn(() => ['kg', 'g', 'l', 'ml', 'pcs', 'box'])
}))

const mockItem = {
  id: '1',
  itemId: 'A001',
  name: 'Test Product',
  quantity: 100,
  unit: 'kg'
}

const mockOnSave = jest.fn()
const mockOnClose = jest.fn()

describe('EditItemDialog Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders dialog when open', () => {
    render(
      <EditItemDialog
        isOpen={true}
        onClose={mockOnClose}
        item={mockItem}
        onSave={mockOnSave}
      />
    )

    expect(screen.getByText('Edit Item')).toBeInTheDocument()
    expect(screen.getByText('Make changes to the item details below.')).toBeInTheDocument()
  })

  it('does not render dialog when closed', () => {
    render(
      <EditItemDialog
        isOpen={false}
        onClose={mockOnClose}
        item={mockItem}
        onSave={mockOnSave}
      />
    )

    expect(screen.queryByText('Edit Item')).not.toBeInTheDocument()
  })

  it('populates form fields with item data', () => {
    render(
      <EditItemDialog
        isOpen={true}
        onClose={mockOnClose}
        item={mockItem}
        onSave={mockOnSave}
      />
    )

    expect(screen.getByDisplayValue('A001')).toBeInTheDocument() // Item ID
    expect(screen.getByDisplayValue('Test Product')).toBeInTheDocument() // Name
    expect(screen.getByDisplayValue('100')).toBeInTheDocument() // Quantity
    expect(screen.getByDisplayValue('kg')).toBeInTheDocument() // Unit
  })

  it('handles item without itemId', () => {
    const itemWithoutId = { ...mockItem, itemId: undefined }
    
    render(
      <EditItemDialog
        isOpen={true}
        onClose={mockOnClose}
        item={itemWithoutId}
        onSave={mockOnSave}
      />
    )

    const itemIdInput = screen.getByLabelText('Item ID')
    expect(itemIdInput).toHaveValue('')
  })

  it('updates form fields when typing', async () => {
    const user = userEvent.setup()
    
    render(
      <EditItemDialog
        isOpen={true}
        onClose={mockOnClose}
        item={mockItem}
        onSave={mockOnSave}
      />
    )

    const nameInput = screen.getByLabelText('Name')
    await user.clear(nameInput)
    await user.type(nameInput, 'Updated Product')

    expect(nameInput).toHaveValue('Updated Product')
  })

  it('updates quantity field', async () => {
    const user = userEvent.setup()
    
    render(
      <EditItemDialog
        isOpen={true}
        onClose={mockOnClose}
        item={mockItem}
        onSave={mockOnSave}
      />
    )

    const quantityInput = screen.getByLabelText('Quantity')
    await user.clear(quantityInput)
    await user.type(quantityInput, '150.5')

    expect(quantityInput).toHaveValue(150.5)
  })

  it('calls onClose when cancel button is clicked', async () => {
    const user = userEvent.setup()
    
    render(
      <EditItemDialog
        isOpen={true}
        onClose={mockOnClose}
        item={mockItem}
        onSave={mockOnSave}
      />
    )

    const cancelButton = screen.getByText('Cancel')
    await user.click(cancelButton)

    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('calls onSave with updated data when save button is clicked', async () => {
    const user = userEvent.setup()
    
    render(
      <EditItemDialog
        isOpen={true}
        onClose={mockOnClose}
        item={mockItem}
        onSave={mockOnSave}
      />
    )

    // Update the name
    const nameInput = screen.getByLabelText('Name')
    await user.clear(nameInput)
    await user.type(nameInput, 'Updated Product')

    // Update the quantity
    const quantityInput = screen.getByLabelText('Quantity')
    await user.clear(quantityInput)
    await user.type(quantityInput, '150')

    const saveButton = screen.getByText('Save Changes')
    await user.click(saveButton)

    expect(mockOnSave).toHaveBeenCalledWith({
      id: '1',
      itemId: 'A001',
      name: 'Updated Product',
      quantity: 150,
      unit: 'kg'
    })
  })

  it('disables save button when required fields are empty', () => {
    render(
      <EditItemDialog
        isOpen={true}
        onClose={mockOnClose}
        item={{ ...mockItem, name: '', quantity: 0, unit: '' }}
        onSave={mockOnSave}
      />
    )

    const saveButton = screen.getByText('Save Changes')
    expect(saveButton).toBeDisabled()
  })

  it('enables save button when all required fields are filled', () => {
    render(
      <EditItemDialog
        isOpen={true}
        onClose={mockOnClose}
        item={mockItem}
        onSave={mockOnSave}
      />
    )

    const saveButton = screen.getByText('Save Changes')
    expect(saveButton).not.toBeDisabled()
  })

  it('handles empty name field validation', async () => {
    const user = userEvent.setup()
    
    render(
      <EditItemDialog
        isOpen={true}
        onClose={mockOnClose}
        item={mockItem}
        onSave={mockOnSave}
      />
    )

    const nameInput = screen.getByLabelText('Name')
    await user.clear(nameInput)

    const saveButton = screen.getByText('Save Changes')
    expect(saveButton).toBeDisabled()
  })

  it('handles empty quantity field validation', async () => {
    const user = userEvent.setup()
    
    render(
      <EditItemDialog
        isOpen={true}
        onClose={mockOnClose}
        item={mockItem}
        onSave={mockOnSave}
      />
    )

    const quantityInput = screen.getByLabelText('Quantity')
    await user.clear(quantityInput)

    const saveButton = screen.getByText('Save Changes')
    expect(saveButton).toBeDisabled()
  })

  it('renders unit select with common units', () => {
    render(
      <EditItemDialog
        isOpen={true}
        onClose={mockOnClose}
        item={mockItem}
        onSave={mockOnSave}
      />
    )

    // Click on the select trigger to open the dropdown
    const selectTrigger = screen.getByRole('combobox')
    fireEvent.click(selectTrigger)

    // Check if common units are available
    expect(screen.getByText('kg')).toBeInTheDocument()
    expect(screen.getByText('g')).toBeInTheDocument()
    expect(screen.getByText('l')).toBeInTheDocument()
    expect(screen.getByText('ml')).toBeInTheDocument()
    expect(screen.getByText('Custom...')).toBeInTheDocument()
  })

  it('shows custom unit input when custom is selected', async () => {
    const user = userEvent.setup()
    
    render(
      <EditItemDialog
        isOpen={true}
        onClose={mockOnClose}
        item={mockItem}
        onSave={mockOnSave}
      />
    )

    // Click on the select trigger to open the dropdown
    const selectTrigger = screen.getByRole('combobox')
    await user.click(selectTrigger)

    // Select custom option
    const customOption = screen.getByText('Custom...')
    await user.click(customOption)

    // Check if custom input appears
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter custom unit')).toBeInTheDocument()
    })
  })

  it('handles null item gracefully', () => {
    render(
      <EditItemDialog
        isOpen={true}
        onClose={mockOnClose}
        item={null}
        onSave={mockOnSave}
      />
    )

    expect(screen.getByText('Edit Item')).toBeInTheDocument()
    
    // Form should be empty
    const itemIdInput = screen.getByLabelText('Item ID')
    const nameInput = screen.getByLabelText('Name')
    const quantityInput = screen.getByLabelText('Quantity')
    
    expect(itemIdInput).toHaveValue('')
    expect(nameInput).toHaveValue('')
    expect(quantityInput).toHaveValue('')
  })

  it('handles decimal quantities correctly', async () => {
    const user = userEvent.setup()
    
    render(
      <EditItemDialog
        isOpen={true}
        onClose={mockOnClose}
        item={mockItem}
        onSave={mockOnSave}
      />
    )

    const quantityInput = screen.getByLabelText('Quantity')
    await user.clear(quantityInput)
    await user.type(quantityInput, '123.45')

    const saveButton = screen.getByText('Save Changes')
    await user.click(saveButton)

    expect(mockOnSave).toHaveBeenCalledWith({
      id: '1',
      itemId: 'A001',
      name: 'Test Product',
      quantity: 123.45,
      unit: 'kg'
    })
  })

  it('removes itemId from saved data when empty', async () => {
    const user = userEvent.setup()
    
    render(
      <EditItemDialog
        isOpen={true}
        onClose={mockOnClose}
        item={mockItem}
        onSave={mockOnSave}
      />
    )

    // Clear the item ID
    const itemIdInput = screen.getByLabelText('Item ID')
    await user.clear(itemIdInput)

    const saveButton = screen.getByText('Save Changes')
    await user.click(saveButton)

    expect(mockOnSave).toHaveBeenCalledWith({
      id: '1',
      itemId: undefined,
      name: 'Test Product',
      quantity: 100,
      unit: 'kg'
    })
  })
})
