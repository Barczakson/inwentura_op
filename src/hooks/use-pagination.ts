import { useState, useCallback, useMemo } from 'react'

export interface PaginationState {
  page: number
  limit: number
  search: string
  sortBy: string
  sortDirection: 'asc' | 'desc'
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export interface UsePaginationOptions {
  initialPage?: number
  initialLimit?: number
  initialSearch?: string
  initialSortBy?: string
  initialSortDirection?: 'asc' | 'desc'
}

export interface UsePaginationReturn {
  // Current state
  paginationState: PaginationState
  paginationMeta: PaginationMeta | null
  
  // Actions
  setPage: (page: number) => void
  setLimit: (limit: number) => void
  setSearch: (search: string) => void
  setSorting: (sortBy: string, direction: 'asc' | 'desc') => void
  setPaginationMeta: (meta: PaginationMeta) => void
  reset: () => void
  
  // Computed values
  queryParams: URLSearchParams
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
}

export function usePagination(options: UsePaginationOptions = {}): UsePaginationReturn {
  const {
    initialPage = 1,
    initialLimit = 50,
    initialSearch = '',
    initialSortBy = 'name',
    initialSortDirection = 'asc'
  } = options

  const [paginationState, setPaginationState] = useState<PaginationState>({
    page: initialPage,
    limit: initialLimit,
    search: initialSearch,
    sortBy: initialSortBy,
    sortDirection: initialSortDirection
  })

  const [paginationMeta, setPaginationMeta] = useState<PaginationMeta | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const setPage = useCallback((page: number) => {
    setPaginationState(prev => ({ ...prev, page }))
  }, [])

  const setLimit = useCallback((limit: number) => {
    setPaginationState(prev => ({ ...prev, limit, page: 1 })) // Reset to first page
  }, [])

  const setSearch = useCallback((search: string) => {
    setPaginationState(prev => ({ ...prev, search, page: 1 })) // Reset to first page
  }, [])

  const setSorting = useCallback((sortBy: string, direction: 'asc' | 'desc') => {
    setPaginationState(prev => ({ ...prev, sortBy, sortDirection: direction }))
  }, [])

  const reset = useCallback(() => {
    setPaginationState({
      page: initialPage,
      limit: initialLimit,
      search: initialSearch,
      sortBy: initialSortBy,
      sortDirection: initialSortDirection
    })
    setPaginationMeta(null)
  }, [initialPage, initialLimit, initialSearch, initialSortBy, initialSortDirection])

  // Generate query parameters for API calls
  const queryParams = useMemo(() => {
    const params = new URLSearchParams()
    params.set('page', paginationState.page.toString())
    params.set('limit', paginationState.limit.toString())
    
    if (paginationState.search) {
      params.set('search', paginationState.search)
    }
    
    params.set('sortBy', paginationState.sortBy)
    params.set('sortDirection', paginationState.sortDirection)
    
    return params
  }, [paginationState])

  return {
    paginationState,
    paginationMeta,
    setPage,
    setLimit,
    setSearch,
    setSorting,
    setPaginationMeta,
    reset,
    queryParams,
    isLoading,
    setIsLoading
  }
}