'use client'

import { createContext, useContext, ReactNode } from 'react'
import { useAdvancedSearch, SearchFilters, SearchResult, SearchSuggestion } from '@/hooks/use-advanced-search'

interface SearchContextType {
  // State
  filters: SearchFilters
  isLoading: boolean
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
  error: string | null
  searchHistory: SearchSuggestion[]
  suggestions: SearchSuggestion[]

  // Actions
  updateFilters: (updates: Partial<SearchFilters>) => void
  search: (filters?: SearchFilters, page?: number, limit?: number) => Promise<any>
  reset: () => void
  getSuggestions: (query: string, type?: 'all' | 'items' | 'units' | 'files', limit?: number) => Promise<SearchSuggestion[]>
  setSuggestions: (suggestions: SearchSuggestion[]) => void

  // Pagination
  nextPage: () => void
  prevPage: () => void
  goToPage: (page: number) => void
  changeLimit: (limit: number) => void

  // History
  clearHistory: () => void

  // Helpers
  hasActiveFilters: () => boolean
}

const SearchContext = createContext<SearchContextType | null>(null)

interface SearchProviderProps {
  children: ReactNode
  initialFilters?: SearchFilters
  autoSearch?: boolean
  debounceMs?: number
}

export function SearchProvider({ 
  children, 
  initialFilters,
  autoSearch = false, // Default to false to prevent auto-search in main app
  debounceMs = 300 
}: SearchProviderProps) {
  const searchHook = useAdvancedSearch({
    initialFilters,
    autoSearch,
    debounceMs
  })

  return (
    <SearchContext.Provider value={searchHook}>
      {children}
    </SearchContext.Provider>
  )
}

export function useSearch() {
  const context = useContext(SearchContext)
  if (!context) {
    throw new Error('useSearch must be used within a SearchProvider')
  }
  return context
}

// Higher-order component for easy integration
export function withSearch<P extends object>(
  Component: React.ComponentType<P>
) {
  return function SearchWrapper(props: P) {
    return (
      <SearchProvider>
        <Component {...props} />
      </SearchProvider>
    )
  }
}