'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  Search, 
  Clock, 
  BarChart3, 
  FileSpreadsheet, 
  TrendingUp,
  Filter,
  Download,
  Share,
  Bookmark,
  BookmarkCheck
} from 'lucide-react'
import { AdvancedSearch, SearchFilters } from '@/components/advanced-search'
import { DataTable } from '@/components/data-table'
import { SearchProvider, useSearch } from '@/components/search-provider'
import { formatQuantityWithConversion } from '@/lib/unit-conversion'
import { toast } from '@/hooks/use-toast'

function SearchPageContent() {
  const {
    filters,
    isLoading,
    results,
    pagination,
    stats,
    error,
    searchHistory,
    updateFilters,
    search,
    reset,
    nextPage,
    prevPage,
    goToPage,
    changeLimit,
    hasActiveFilters
  } = useSearch()

  const [availableFiles, setAvailableFiles] = useState<Array<{ id: string; name: string }>>([])
  const [availableUnits, setAvailableUnits] = useState<string[]>([])
  const [savedSearches, setSavedSearches] = useState<Array<{
    id: string
    name: string
    filters: SearchFilters
    createdAt: Date
  }>>([])

  // Load available filters data
  useEffect(() => {
    const loadFilterData = async () => {
      try {
        // Load files
        const filesResponse = await fetch('/api/excel/files')
        if (filesResponse.ok) {
          const filesData = await filesResponse.json()
          setAvailableFiles(filesData.files || [])
        }

        // Load units from existing data
        const unitsResponse = await fetch('/api/search?q=&type=units&limit=50')
        if (unitsResponse.ok) {
          const unitsData = await unitsResponse.json()
          setAvailableUnits(unitsData.suggestions?.map((s: any) => s.text) || [])
        }
      } catch (error) {
        console.error('Failed to load filter data:', error)
      }
    }

    loadFilterData()
  }, [])

  // Load saved searches
  useEffect(() => {
    try {
      const saved = localStorage.getItem('saved-searches')
      if (saved) {
        setSavedSearches(JSON.parse(saved).map((search: any) => ({
          ...search,
          createdAt: new Date(search.createdAt)
        })))
      }
    } catch (error) {
      console.error('Failed to load saved searches:', error)
    }
  }, [])

  const handleSearch = (newFilters: SearchFilters) => {
    updateFilters(newFilters)
    search(newFilters)
  }

  const saveCurrentSearch = () => {
    if (!filters.query && !hasActiveFilters()) {
      toast({
        title: "Nothing to save",
        description: "Please enter a search query or apply filters first.",
        variant: "destructive"
      })
      return
    }

    const name = prompt('Enter a name for this search:')
    if (!name) return

    const newSavedSearch = {
      id: Date.now().toString(),
      name,
      filters,
      createdAt: new Date()
    }

    const updated = [...savedSearches, newSavedSearch]
    setSavedSearches(updated)

    try {
      localStorage.setItem('saved-searches', JSON.stringify(updated))
      toast({
        title: "Search saved",
        description: `Saved as "${name}"`,
      })
    } catch (error) {
      toast({
        title: "Save failed",
        description: "Could not save search. Please try again.",
        variant: "destructive"
      })
    }
  }

  const loadSavedSearch = (savedSearch: typeof savedSearches[0]) => {
    updateFilters(savedSearch.filters)
    search(savedSearch.filters)
    toast({
      title: "Search loaded",
      description: `Loaded "${savedSearch.name}"`,
    })
  }

  const deleteSavedSearch = (id: string) => {
    const updated = savedSearches.filter(s => s.id !== id)
    setSavedSearches(updated)
    try {
      localStorage.setItem('saved-searches', JSON.stringify(updated))
      toast({
        title: "Search deleted",
        description: "Saved search has been removed.",
      })
    } catch (error) {
      toast({
        title: "Delete failed",
        description: "Could not delete search. Please try again.",
        variant: "destructive"
      })
    }
  }

  const exportResults = () => {
    if (results.length === 0) {
      toast({
        title: "No data to export",
        description: "Please perform a search first.",
        variant: "destructive"
      })
      return
    }

    // Convert to CSV
    const headers = ['Name', 'Item ID', 'Quantity', 'Unit', 'Type', 'File']
    const csvData = results.map(item => [
      item.name,
      item.itemId || '',
      item.quantity,
      item.unit,
      item.isAggregated ? 'Aggregated' : 'Raw',
      item.file?.fileName || ''
    ])

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `search-results-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)

    toast({
      title: "Export complete",
      description: `Exported ${results.length} results to CSV`,
    })
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Search className="h-8 w-8" />
            Advanced Search
          </h1>
          <p className="text-muted-foreground mt-1">
            Search across all your inventory data with powerful filters
          </p>
        </div>
        <div className="flex gap-2">
          {(filters.query || hasActiveFilters()) && (
            <>
              <Button
                variant="outline"
                onClick={saveCurrentSearch}
                className="gap-2"
              >
                <Bookmark className="h-4 w-4" />
                Save Search
              </Button>
              <Button
                variant="outline"
                onClick={exportResults}
                disabled={results.length === 0}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Export Results
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          {/* Saved Searches */}
          {savedSearches.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BookmarkCheck className="h-4 w-4" />
                  Saved Searches
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {savedSearches.map(savedSearch => (
                  <div
                    key={savedSearch.id}
                    className="flex items-center justify-between p-2 rounded hover:bg-muted cursor-pointer"
                    onClick={() => loadSavedSearch(savedSearch)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{savedSearch.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {savedSearch.createdAt.toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteSavedSearch(savedSearch.id)
                      }}
                      className="h-6 w-6 p-0"
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Search Stats */}
          {stats.totalResults > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Search Statistics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Total Results:</span>
                  <Badge variant="outline">{stats.totalResults}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Aggregated:</span>
                  <Badge variant="secondary">{stats.aggregatedCount}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Raw Items:</span>
                  <Badge variant="outline">{stats.rawCount}</Badge>
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span>Unique Units:</span>
                  <Badge variant="outline">{stats.uniqueUnits.length}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  Quantity Range: {formatQuantityWithConversion(stats.quantityRange.min)} - {formatQuantityWithConversion(stats.quantityRange.max)}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Searches */}
          {searchHistory.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Recent Searches
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {searchHistory.slice(0, 5).map((item, index) => (
                    <div
                      key={index}
                      className="p-2 rounded hover:bg-muted cursor-pointer text-sm"
                      onClick={() => {
                        if (item.filters) {
                          updateFilters(item.filters)
                          search(item.filters)
                        }
                      }}
                    >
                      {item.text}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* Search Component */}
          <Card>
            <CardContent className="p-6">
              <AdvancedSearch
                onSearch={handleSearch}
                onReset={reset}
                availableFiles={availableFiles}
                availableUnits={availableUnits}
                searchHistory={searchHistory}
                savedSearches={savedSearches.map(s => ({
                  text: s.name,
                  type: 'saved' as const,
                  filters: s.filters
                }))}
                isLoading={isLoading}
                showAdvanced={true}
                defaultFilters={filters}
              />
            </CardContent>
          </Card>

          {/* Error State */}
          {error && (
            <Card className="border-destructive">
              <CardContent className="p-6">
                <div className="text-destructive">
                  <h3 className="font-semibold">Search Error</h3>
                  <p className="text-sm">{error}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Results */}
          {results.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5" />
                    Search Results
                    <Badge variant="outline">
                      {stats.totalResults} total
                    </Badge>
                  </CardTitle>
                  <div className="text-sm text-muted-foreground">
                    Page {pagination.page} of {pagination.totalPages}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <DataTable
                  data={results.map(item => ({
                    ...item,
                    isAggregated: item.isAggregated || false
                  }))}
                  uploadedFiles={availableFiles}
                  paginationState={{
                    page: pagination.page,
                    limit: pagination.limit,
                    search: filters.query,
                    sortBy: 'name',
                    sortDirection: 'asc' as const
                  }}
                  paginationMeta={pagination}
                  onPaginationChange={{
                    setPage: goToPage,
                    setLimit: changeLimit,
                    setSearch: (query) => updateFilters({ query }),
                    setSorting: () => {} // TODO: Implement sorting
                  }}
                  isLoading={isLoading}
                  enableVirtualization={results.length > 100}
                />
              </CardContent>
            </Card>
          )}

          {/* Empty State */}
          {!isLoading && results.length === 0 && (filters.query || hasActiveFilters()) && (
            <Card>
              <CardContent className="p-12 text-center">
                <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No results found</h3>
                <p className="text-muted-foreground mb-4">
                  Try adjusting your search terms or filters
                </p>
                <Button onClick={reset} variant="outline">
                  Clear Search
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Welcome State */}
          {!isLoading && results.length === 0 && !filters.query && !hasActiveFilters() && (
            <Card>
              <CardContent className="p-12 text-center">
                <Search className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">Advanced Search</h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Search across all your inventory data with powerful filters. 
                  Find items by name, ID, quantity, unit, or source file.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
                  <div className="text-center">
                    <TrendingUp className="h-8 w-8 mx-auto text-primary mb-2" />
                    <h4 className="font-semibold text-sm">Smart Filters</h4>
                    <p className="text-xs text-muted-foreground">
                      Filter by quantity range, units, and more
                    </p>
                  </div>
                  <div className="text-center">
                    <Clock className="h-8 w-8 mx-auto text-primary mb-2" />
                    <h4 className="font-semibold text-sm">Search History</h4>
                    <p className="text-xs text-muted-foreground">
                      Access your recent and saved searches
                    </p>
                  </div>
                  <div className="text-center">
                    <Download className="h-8 w-8 mx-auto text-primary mb-2" />
                    <h4 className="font-semibold text-sm">Export Results</h4>
                    <p className="text-xs text-muted-foreground">
                      Download search results as CSV
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

export default function SearchPage() {
  return (
    <SearchProvider autoSearch={false}>
      <SearchPageContent />
    </SearchProvider>
  )
}