import { renderHook, act } from '@testing-library/react'
import { usePagination, UsePaginationOptions } from '../use-pagination'

describe('usePagination Hook', () => {
  it('should initialize with default values', () => {
    const { result } = renderHook(() => usePagination())

    expect(result.current.paginationState).toEqual({
      page: 1,
      limit: 50,
      search: '',
      sortBy: 'name',
      sortDirection: 'asc'
    })
    expect(result.current.paginationMeta).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  it('should initialize with custom options', () => {
    const options: UsePaginationOptions = {
      initialPage: 2,
      initialLimit: 25,
      initialSearch: 'test search',
      initialSortBy: 'date',
      initialSortDirection: 'desc'
    }

    const { result } = renderHook(() => usePagination(options))

    expect(result.current.paginationState).toEqual({
      page: 2,
      limit: 25,
      search: 'test search',
      sortBy: 'date',
      sortDirection: 'desc'
    })
  })

  it('should update page correctly', () => {
    const { result } = renderHook(() => usePagination())

    act(() => {
      result.current.setPage(3)
    })

    expect(result.current.paginationState.page).toBe(3)
    // Other values should remain unchanged
    expect(result.current.paginationState.limit).toBe(50)
    expect(result.current.paginationState.search).toBe('')
  })

  it('should update limit and reset page to 1', () => {
    const { result } = renderHook(() => usePagination({ initialPage: 5 }))

    act(() => {
      result.current.setLimit(100)
    })

    expect(result.current.paginationState.limit).toBe(100)
    expect(result.current.paginationState.page).toBe(1) // Should reset to page 1
  })

  it('should update search and reset page to 1', () => {
    const { result } = renderHook(() => usePagination({ initialPage: 3 }))

    act(() => {
      result.current.setSearch('new search')
    })

    expect(result.current.paginationState.search).toBe('new search')
    expect(result.current.paginationState.page).toBe(1) // Should reset to page 1
  })

  it('should update sorting correctly', () => {
    const { result } = renderHook(() => usePagination())

    act(() => {
      result.current.setSorting('quantity', 'desc')
    })

    expect(result.current.paginationState.sortBy).toBe('quantity')
    expect(result.current.paginationState.sortDirection).toBe('desc')
    // Page should not reset for sorting
    expect(result.current.paginationState.page).toBe(1)
  })

  it('should update pagination meta', () => {
    const { result } = renderHook(() => usePagination())

    const mockMeta = {
      page: 2,
      limit: 25,
      total: 100,
      totalPages: 4,
      hasNext: true,
      hasPrev: true
    }

    act(() => {
      result.current.setPaginationMeta(mockMeta)
    })

    expect(result.current.paginationMeta).toEqual(mockMeta)
  })

  it('should update loading state', () => {
    const { result } = renderHook(() => usePagination())

    expect(result.current.isLoading).toBe(false)

    act(() => {
      result.current.setIsLoading(true)
    })

    expect(result.current.isLoading).toBe(true)

    act(() => {
      result.current.setIsLoading(false)
    })

    expect(result.current.isLoading).toBe(false)
  })

  it('should reset to initial values', () => {
    const options: UsePaginationOptions = {
      initialPage: 2,
      initialLimit: 25,
      initialSearch: 'initial search',
      initialSortBy: 'date',
      initialSortDirection: 'desc'
    }

    const { result } = renderHook(() => usePagination(options))

    // Change some values
    act(() => {
      result.current.setPage(5)
      result.current.setLimit(100)
      result.current.setSearch('changed search')
      result.current.setSorting('name', 'asc')
      result.current.setPaginationMeta({
        page: 5,
        limit: 100,
        total: 500,
        totalPages: 5,
        hasNext: false,
        hasPrev: true
      })
    })

    // Reset
    act(() => {
      result.current.reset()
    })

    expect(result.current.paginationState).toEqual({
      page: 2,
      limit: 25,
      search: 'initial search',
      sortBy: 'date',
      sortDirection: 'desc'
    })
    expect(result.current.paginationMeta).toBeNull()
  })

  it('should generate correct query parameters', () => {
    const { result } = renderHook(() => usePagination({
      initialPage: 2,
      initialLimit: 25,
      initialSearch: 'test search',
      initialSortBy: 'quantity',
      initialSortDirection: 'desc'
    }))

    const params = result.current.queryParams

    expect(params.get('page')).toBe('2')
    expect(params.get('limit')).toBe('25')
    expect(params.get('search')).toBe('test search')
    expect(params.get('sortBy')).toBe('quantity')
    expect(params.get('sortDirection')).toBe('desc')
  })

  it('should not include search in query params when empty', () => {
    const { result } = renderHook(() => usePagination())

    const params = result.current.queryParams

    expect(params.get('page')).toBe('1')
    expect(params.get('limit')).toBe('50')
    expect(params.get('search')).toBeNull() // Should not be included when empty
    expect(params.get('sortBy')).toBe('name')
    expect(params.get('sortDirection')).toBe('asc')
  })

  it('should update query parameters when state changes', () => {
    const { result } = renderHook(() => usePagination())

    // Initial params
    let params = result.current.queryParams
    expect(params.get('page')).toBe('1')
    expect(params.get('search')).toBeNull()

    // Update search
    act(() => {
      result.current.setSearch('new search')
    })

    params = result.current.queryParams
    expect(params.get('page')).toBe('1') // Reset to page 1
    expect(params.get('search')).toBe('new search')

    // Update page
    act(() => {
      result.current.setPage(3)
    })

    params = result.current.queryParams
    expect(params.get('page')).toBe('3')
    expect(params.get('search')).toBe('new search')
  })

  it('should handle multiple state updates correctly', () => {
    const { result } = renderHook(() => usePagination())

    act(() => {
      result.current.setPage(2)
      result.current.setLimit(100)
      result.current.setSearch('test')
      result.current.setSorting('date', 'desc')
    })

    expect(result.current.paginationState).toEqual({
      page: 1, // Should be 1 because setLimit and setSearch reset page
      limit: 100,
      search: 'test',
      sortBy: 'date',
      sortDirection: 'desc'
    })
  })

  it('should maintain stable function references', () => {
    const { result, rerender } = renderHook(() => usePagination())

    const initialFunctions = {
      setPage: result.current.setPage,
      setLimit: result.current.setLimit,
      setSearch: result.current.setSearch,
      setSorting: result.current.setSorting,
      setPaginationMeta: result.current.setPaginationMeta,
      reset: result.current.reset,
      setIsLoading: result.current.setIsLoading
    }

    // Trigger a re-render
    rerender()

    // Functions should be the same references (memoized)
    expect(result.current.setPage).toBe(initialFunctions.setPage)
    expect(result.current.setLimit).toBe(initialFunctions.setLimit)
    expect(result.current.setSearch).toBe(initialFunctions.setSearch)
    expect(result.current.setSorting).toBe(initialFunctions.setSorting)
    expect(result.current.setPaginationMeta).toBe(initialFunctions.setPaginationMeta)
    expect(result.current.reset).toBe(initialFunctions.reset)
    expect(result.current.setIsLoading).toBe(initialFunctions.setIsLoading)
  })

  it('should handle edge cases for page numbers', () => {
    const { result } = renderHook(() => usePagination())

    // Test negative page
    act(() => {
      result.current.setPage(-1)
    })
    expect(result.current.paginationState.page).toBe(-1) // Hook doesn't validate, that's up to the consumer

    // Test zero page
    act(() => {
      result.current.setPage(0)
    })
    expect(result.current.paginationState.page).toBe(0)

    // Test very large page
    act(() => {
      result.current.setPage(999999)
    })
    expect(result.current.paginationState.page).toBe(999999)
  })

  it('should handle edge cases for limits', () => {
    const { result } = renderHook(() => usePagination())

    // Test very small limit
    act(() => {
      result.current.setLimit(1)
    })
    expect(result.current.paginationState.limit).toBe(1)

    // Test very large limit
    act(() => {
      result.current.setLimit(10000)
    })
    expect(result.current.paginationState.limit).toBe(10000)
  })

  it('should handle special characters in search', () => {
    const { result } = renderHook(() => usePagination())

    const specialSearch = 'test & search with "quotes" and <tags>'

    act(() => {
      result.current.setSearch(specialSearch)
    })

    expect(result.current.paginationState.search).toBe(specialSearch)
    expect(result.current.queryParams.get('search')).toBe(specialSearch)
  })
})
