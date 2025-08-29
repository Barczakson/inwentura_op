/**
 * Advanced Search Component Tests
 * 
 * Tests for the comprehensive search functionality including:
 * - Search input and filters
 * - Search suggestions and autocomplete
 * - Filter management and persistence
 * - Search history functionality
 * - Complex search scenarios
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AdvancedSearch, SearchFilters } from '../advanced-search'

// Mock the useDebounce hook
jest.mock('../../hooks/use-debounce', () => ({
  useDebounce: (value: any, delay: number) => value
}))

describe('AdvancedSearch Component', () => {
  const defaultProps = {
    onSearch: jest.fn(),
    onReset: jest.fn(),
    availableFiles: [
      { id: 'file-1', name: 'inventory-2024.xlsx' },
      { id: 'file-2', name: 'products-jan.xlsx' }
    ],
    availableUnits: ['kg', 'g', 'l', 'ml', 'szt'],
    availableCategories: ['Food', 'Electronics', 'Clothing'],
    searchHistory: [
      { text: 'Recent search', type: 'recent' as const },
      { text: 'Another search', type: 'recent' as const }
    ],
    savedSearches: [
      { text: 'Saved search', type: 'saved' as const }
    ]
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Basic Functionality', () => {
    it('should render search input with placeholder', () => {
      render(<AdvancedSearch {...defaultProps} />)
      
      expect(screen.getByPlaceholderText(/search items/i)).toBeInTheDocument()
    })

    it('should call onSearch when typing in search input', async () => {
      const user = userEvent.setup()
      render(<AdvancedSearch {...defaultProps} />)
      
      const searchInput = screen.getByPlaceholderText(/search items/i)
      await user.type(searchInput, 'test query')
      
      await waitFor(() => {
        expect(defaultProps.onSearch).toHaveBeenCalledWith({
          query: 'test query'
        })
      })
    })

    it('should show clear button when search query exists', async () => {
      const user = userEvent.setup()
      render(<AdvancedSearch {...defaultProps} />)
      
      const searchInput = screen.getByPlaceholderText(/search items/i)
      await user.type(searchInput, 'test')
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument()
      })
    })

    it('should call onReset when clear button is clicked', async () => {
      const user = userEvent.setup()
      render(<AdvancedSearch {...defaultProps} />)
      
      const searchInput = screen.getByPlaceholderText(/search items/i)
      await user.type(searchInput, 'test')
      
      await waitFor(() => {
        const clearButton = screen.getByRole('button', { name: /clear/i })
        return user.click(clearButton)
      })
      
      expect(defaultProps.onReset).toHaveBeenCalled()
    })
  })

  describe('Advanced Filters', () => {
    it('should show filter button with count when filters are active', async () => {
      const user = userEvent.setup()
      render(<AdvancedSearch {...defaultProps} showAdvanced={true} />)
      
      // Open advanced filters
      const filterButton = screen.getByRole('button', { name: /filter/i })
      await user.click(filterButton)
      
      // Add a unit filter
      const kgCheckbox = screen.getByLabelText('kg')
      await user.click(kgCheckbox)
      
      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument() // Filter count
      })
    })

    it('should handle Item ID filter', async () => {
      const user = userEvent.setup()
      render(<AdvancedSearch {...defaultProps} showAdvanced={true} />)
      
      const filterButton = screen.getByRole('button', { name: /filter/i })
      await user.click(filterButton)
      
      const itemIdInput = screen.getByPlaceholderText(/search by specific item id/i)
      await user.type(itemIdInput, 'ITEM001')
      
      await waitFor(() => {
        expect(defaultProps.onSearch).toHaveBeenCalledWith({
          query: '',
          itemId: 'ITEM001'
        })
      })
    })

    it('should handle unit filters', async () => {
      const user = userEvent.setup()
      render(<AdvancedSearch {...defaultProps} showAdvanced={true} />)
      
      const filterButton = screen.getByRole('button', { name: /filter/i })
      await user.click(filterButton)
      
      const kgCheckbox = screen.getByLabelText('kg')
      const gCheckbox = screen.getByLabelText('g')
      
      await user.click(kgCheckbox)
      await user.click(gCheckbox)
      
      await waitFor(() => {
        expect(defaultProps.onSearch).toHaveBeenCalledWith({
          query: '',
          units: expect.arrayContaining(['kg', 'g'])
        })
      })
    })

    it('should handle quantity range filters', async () => {
      const user = userEvent.setup()
      render(<AdvancedSearch {...defaultProps} showAdvanced={true} />)
      
      const filterButton = screen.getByRole('button', { name: /filter/i })
      await user.click(filterButton)
      
      const minInput = screen.getByLabelText('Min')
      const maxInput = screen.getByLabelText('Max')
      
      await user.type(minInput, '10')
      await user.type(maxInput, '100')
      
      await waitFor(() => {
        expect(defaultProps.onSearch).toHaveBeenCalledWith({
          query: '',
          quantityMin: 10,
          quantityMax: 100
        })
      })
    })

    it('should handle file selection filter', async () => {
      const user = userEvent.setup()
      render(<AdvancedSearch {...defaultProps} showAdvanced={true} />)
      
      const filterButton = screen.getByRole('button', { name: /filter/i })
      await user.click(filterButton)
      
      const fileSelect = screen.getByRole('combobox', { name: /add file filter/i })
      await user.click(fileSelect)
      
      const fileOption = screen.getByText('inventory-2024.xlsx')
      await user.click(fileOption)
      
      await waitFor(() => {
        expect(defaultProps.onSearch).toHaveBeenCalledWith({
          query: '',
          fileIds: ['file-1']
        })
      })
    })
  })

  describe('Active Filters Display', () => {
    it('should display active filters as badges', async () => {
      const user = userEvent.setup()
      render(
        <AdvancedSearch 
          {...defaultProps} 
          showAdvanced={true}
          defaultFilters={{
            query: '',
            itemId: 'ITEM001',
            units: ['kg', 'g']
          }}
        />
      )
      
      expect(screen.getByText('Item ID: ITEM001')).toBeInTheDocument()
      expect(screen.getByText('Unit: kg')).toBeInTheDocument()
      expect(screen.getByText('Unit: g')).toBeInTheDocument()
    })

    it('should allow removing individual filters', async () => {
      const user = userEvent.setup()
      render(
        <AdvancedSearch 
          {...defaultProps} 
          showAdvanced={true}
          defaultFilters={{
            query: '',
            units: ['kg', 'g']
          }}
        />
      )
      
      const kgBadge = screen.getByText('Unit: kg').parentElement!
      const removeButton = kgBadge.querySelector('button')!
      
      await user.click(removeButton)
      
      await waitFor(() => {
        expect(defaultProps.onSearch).toHaveBeenCalledWith({
          query: '',
          units: ['g'] // kg should be removed
        })
      })
    })
  })

  describe('Search Suggestions', () => {
    it('should show suggestions when input is focused', async () => {
      const user = userEvent.setup()
      render(<AdvancedSearch {...defaultProps} />)
      
      const searchInput = screen.getByPlaceholderText(/search items/i)
      await user.click(searchInput)
      
      await waitFor(() => {
        expect(screen.getByText('Recent search')).toBeInTheDocument()
        expect(screen.getByText('Saved search')).toBeInTheDocument()
      })
    })

    it('should handle suggestion clicks', async () => {
      const user = userEvent.setup()
      const mockSavedSearch = {
        text: 'Saved search',
        type: 'saved' as const,
        filters: { query: 'saved query', units: ['kg'] }
      }
      
      render(
        <AdvancedSearch 
          {...defaultProps} 
          savedSearches={[mockSavedSearch]}
        />
      )
      
      const searchInput = screen.getByPlaceholderText(/search items/i)
      await user.click(searchInput)
      
      await waitFor(async () => {
        const suggestion = screen.getByText('Saved search')
        await user.click(suggestion)
      })
      
      expect(defaultProps.onSearch).toHaveBeenCalledWith({
        query: 'saved query',
        units: ['kg']
      })
    })

    it('should show different suggestion icons by type', async () => {
      const user = userEvent.setup()
      render(<AdvancedSearch {...defaultProps} />)
      
      const searchInput = screen.getByPlaceholderText(/search items/i)
      await user.click(searchInput)
      
      await waitFor(() => {
        // Should have clock icon for recent searches
        expect(document.querySelector('.lucide-clock')).toBeInTheDocument()
        // Should have star icon for saved searches
        expect(document.querySelector('.lucide-star')).toBeInTheDocument()
      })
    })
  })

  describe('Loading States', () => {
    it('should show loading state when isLoading is true', () => {
      render(<AdvancedSearch {...defaultProps} isLoading={true} />)
      
      // The search input should still be accessible during loading
      expect(screen.getByPlaceholderText(/search items/i)).toBeInTheDocument()
    })
  })

  describe('Complex Filter Scenarios', () => {
    it('should handle multiple complex filters simultaneously', async () => {
      const user = userEvent.setup()
      render(<AdvancedSearch {...defaultProps} showAdvanced={true} />)
      
      const filterButton = screen.getByRole('button', { name: /filter/i })
      await user.click(filterButton)
      
      // Set multiple filters
      const searchInput = screen.getByPlaceholderText(/search items/i)
      await user.type(searchInput, 'electronics')
      
      const itemIdInput = screen.getByPlaceholderText(/search by specific item id/i)
      await user.type(itemIdInput, 'ELC')
      
      const kgCheckbox = screen.getByLabelText('kg')
      await user.click(kgCheckbox)
      
      const minInput = screen.getByLabelText('Min')
      await user.type(minInput, '5')
      
      const hasItemIdCheckbox = screen.getByLabelText(/items with item id only/i)
      await user.click(hasItemIdCheckbox)
      
      await waitFor(() => {
        expect(defaultProps.onSearch).toHaveBeenCalledWith({
          query: 'electronics',
          itemId: 'ELC',
          units: ['kg'],
          quantityMin: 5,
          hasItemId: true
        })
      })
    })

    it('should clear all filters when clear button is clicked', async () => {
      const user = userEvent.setup()
      render(
        <AdvancedSearch 
          {...defaultProps} 
          showAdvanced={true}
          defaultFilters={{
            query: 'test',
            itemId: 'ITEM001',
            units: ['kg']
          }}
        />
      )
      
      const clearButton = screen.getByRole('button', { name: /clear/i })
      await user.click(clearButton)
      
      expect(defaultProps.onReset).toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      render(<AdvancedSearch {...defaultProps} showAdvanced={true} />)
      
      const searchInput = screen.getByPlaceholderText(/search items/i)
      expect(searchInput).toHaveAttribute('type', 'text')
      
      // Filter button should be accessible
      const filterButton = screen.getByRole('button', { name: /filter/i })
      expect(filterButton).toBeInTheDocument()
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<AdvancedSearch {...defaultProps} />)
      
      const searchInput = screen.getByPlaceholderText(/search items/i)
      
      // Tab to search input
      await user.tab()
      expect(searchInput).toHaveFocus()
      
      // Type in search input
      await user.type(searchInput, 'test')
      
      expect(defaultProps.onSearch).toHaveBeenCalledWith({
        query: 'test'
      })
    })
  })

  describe('Responsive Behavior', () => {
    it('should handle mobile viewport', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      })

      render(<AdvancedSearch {...defaultProps} showAdvanced={true} />)
      
      // Component should still render and be functional
      expect(screen.getByPlaceholderText(/search items/i)).toBeInTheDocument()
    })
  })
})