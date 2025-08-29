import { useState, useCallback, useEffect } from 'react'
import { useDebounce } from './use-debounce'

export interface SearchFilters {
  query: string
  itemId?: string
  units?: string[]
  quantityMin?: number
  quantityMax?: number
  fileIds?: string[]
  dateRange?: {
    from?: Date
    to?: Date
  }
  categories?: string[]
  hasItemId?: boolean
  aggregatedOnly?: boolean
}

export interface SearchSuggestion {
  text: string
  type: 'recent' | 'suggestion' | 'saved' | 'item' | 'itemId' | 'unit' | 'file'
  filters?: SearchFilters
  count?: number
  id?: string
  description?: string
}

export interface SearchResult {
  id: string
  itemId?: string
  name: string
  quantity: number
  unit: string
  category?: string
  fileId?: string
  sourceFiles?: string[]
  count?: number
  isAggregated?: boolean
  file?: {
    id: string
    fileName: string
    uploadDate: string
  }
}

export interface SearchResponse {
  results: SearchResult[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
  stats: {
    totalResults: number
    aggregatedCount: number
    rawCount: number
    uniqueUnits: string[]
    quantityRange: {
      min: number
      max: number
    }
  }
  appliedFilters: SearchFilters
  searchTerm: string
  executionTime: number
}

interface UseAdvancedSearchProps {
  initialFilters?: SearchFilters
  autoSearch?: boolean
  debounceMs?: number
}

export function useAdvancedSearch({
  initialFilters = { query: '' },
  autoSearch = true,
  debounceMs = 300
}: UseAdvancedSearchProps = {}) {
  const [filters, setFilters] = useState<SearchFilters>(initialFilters)
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  })
  const [stats, setStats] = useState({
    totalResults: 0,
    aggregatedCount: 0,
    rawCount: 0,
    uniqueUnits: [] as string[],
    quantityRange: { min: 0, max: 0 }
  })
  const [error, setError] = useState<string | null>(null)
  const [searchHistory, setSearchHistory] = useState<SearchSuggestion[]>([])
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])

  // Debounce search query for auto-search
  const debouncedFilters = useDebounce(filters, debounceMs)

  // Load search history from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('search-history')
      if (stored) {
        setSearchHistory(JSON.parse(stored))
      }
    } catch (error) {
      console.error('Failed to load search history:', error)
    }
  }, [])

  // Save search to history
  const saveToHistory = useCallback((searchFilters: SearchFilters) => {
    if (!searchFilters.query && !hasActiveFilters(searchFilters)) return

    const newEntry: SearchSuggestion = {
      text: searchFilters.query || 'Advanced Search',
      type: 'recent',
      filters: searchFilters
    }

    setSearchHistory(prev => {
      const filtered = prev.filter(item => 
        !(item.filters?.query === searchFilters.query && 
          JSON.stringify(item.filters) === JSON.stringify(searchFilters))
      )
      const updated = [newEntry, ...filtered].slice(0, 20) // Keep last 20
      
      try {
        localStorage.setItem('search-history', JSON.stringify(updated))
      } catch (error) {
        console.error('Failed to save search history:', error)
      }
      
      return updated
    })
  }, [])

  // Check if filters have active values
  const hasActiveFilters = useCallback((searchFilters: SearchFilters = filters) => {
    return Boolean(
      searchFilters.itemId ||
      (searchFilters.units && searchFilters.units.length > 0) ||
      searchFilters.quantityMin !== undefined ||
      searchFilters.quantityMax !== undefined ||
      (searchFilters.fileIds && searchFilters.fileIds.length > 0) ||
      searchFilters.dateRange?.from ||
      searchFilters.dateRange?.to ||
      (searchFilters.categories && searchFilters.categories.length > 0) ||
      searchFilters.hasItemId !== undefined ||
      searchFilters.aggregatedOnly
    )
  }, [filters])

  // Perform search
  const search = useCallback(async (
    searchFilters: SearchFilters = filters,
    page = 1,
    limit = 50
  ): Promise<SearchResponse | null> => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filters: searchFilters,
          page,
          limit
        }),
      })

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`)
      }

      const data: SearchResponse = await response.json()
      
      setResults(data.results || [])
      setPagination(data.pagination)
      setStats(data.stats)

      // Save successful searches to history
      if (data.results.length > 0 || searchFilters.query || hasActiveFilters(searchFilters)) {
        saveToHistory(searchFilters)
      }

      return data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Search failed'
      setError(errorMessage)
      console.error('Search error:', err)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [filters, hasActiveFilters, saveToHistory])

  // Get search suggestions
  const getSuggestions = useCallback(async (
    query: string,
    type: 'all' | 'items' | 'units' | 'files' = 'all',
    limit = 10
  ): Promise<SearchSuggestion[]> => {
    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(query)}&type=${type}&limit=${limit}`
      )
      
      if (!response.ok) {
        throw new Error('Failed to get suggestions')
      }

      const data = await response.json()
      return data.suggestions || []
    } catch (error) {
      console.error('Suggestions error:', error)
      return []
    }
  }, [])

  // Auto-search when debounced filters change
  useEffect(() => {
    if (autoSearch && (debouncedFilters.query || hasActiveFilters(debouncedFilters))) {
      search(debouncedFilters, 1, pagination.limit)
    }
  }, [debouncedFilters, autoSearch, hasActiveFilters, search, pagination.limit])

  // Update filters
  const updateFilters = useCallback((updates: Partial<SearchFilters>) => {
    setFilters(prev => ({ ...prev, ...updates }))
  }, [])

  // Reset search
  const reset = useCallback(() => {
    setFilters({ query: '' })
    setResults([])
    setPagination({
      page: 1,
      limit: 50,
      total: 0,
      totalPages: 0,
      hasNext: false,
      hasPrev: false
    })
    setStats({
      totalResults: 0,
      aggregatedCount: 0,
      rawCount: 0,
      uniqueUnits: [],
      quantityRange: { min: 0, max: 0 }
    })
    setError(null)
  }, [])

  // Pagination helpers
  const nextPage = useCallback(() => {
    if (pagination.hasNext) {
      search(filters, pagination.page + 1, pagination.limit)
    }
  }, [pagination, filters, search])

  const prevPage = useCallback(() => {
    if (pagination.hasPrev) {
      search(filters, pagination.page - 1, pagination.limit)
    }
  }, [pagination, filters, search])

  const goToPage = useCallback((page: number) => {
    if (page >= 1 && page <= pagination.totalPages) {
      search(filters, page, pagination.limit)
    }
  }, [pagination.totalPages, filters, search])

  const changeLimit = useCallback((newLimit: number) => {
    search(filters, 1, newLimit)
  }, [filters, search])

  // Clear search history
  const clearHistory = useCallback(() => {
    setSearchHistory([])
    try {
      localStorage.removeItem('search-history')
    } catch (error) {
      console.error('Failed to clear search history:', error)
    }
  }, [])

  return {
    // State
    filters,
    isLoading,
    results,
    pagination,
    stats,
    error,
    searchHistory,
    suggestions,

    // Actions
    updateFilters,
    search,
    reset,
    getSuggestions,
    setSuggestions,

    // Pagination
    nextPage,
    prevPage,
    goToPage,
    changeLimit,

    // History
    clearHistory,

    // Helpers
    hasActiveFilters: () => hasActiveFilters(filters)
  }
}