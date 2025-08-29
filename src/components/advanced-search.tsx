'use client'

import { useState, useCallback, useEffect } from 'react'
import { Search, Filter, X, Clock, Star, ChevronDown, ChevronUp, Calculator } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { Slider } from '@/components/ui/slider'
import { useDebounce } from '@/hooks/use-debounce'

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

interface AdvancedSearchProps {
  onSearch: (filters: SearchFilters) => void
  onReset: () => void
  availableFiles?: Array<{ id: string; name: string }>
  availableUnits?: string[]
  availableCategories?: string[]
  searchHistory?: SearchSuggestion[]
  savedSearches?: SearchSuggestion[]
  isLoading?: boolean
  placeholder?: string
  showAdvanced?: boolean
  defaultFilters?: SearchFilters
}

export function AdvancedSearch({
  onSearch,
  onReset,
  availableFiles = [],
  availableUnits = [],
  availableCategories = [],
  searchHistory = [],
  savedSearches = [],
  isLoading = false,
  placeholder = "Search items, IDs, or descriptions...",
  showAdvanced = true,
  defaultFilters
}: AdvancedSearchProps) {
  const [filters, setFilters] = useState<SearchFilters>(defaultFilters || { query: '' })
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searchSuggestions, setSearchSuggestions] = useState<SearchSuggestion[]>([])

  // Debounce the search query
  const debouncedQuery = useDebounce(filters.query, 300)

  // Generate search suggestions
  const generateSuggestions = useCallback((query: string) => {
    if (!query.trim()) {
      const recentSuggestions = searchHistory.slice(0, 5)
      const savedSuggestions = savedSearches.slice(0, 3)
      setSearchSuggestions([...recentSuggestions, ...savedSuggestions])
      return
    }

    const suggestions: SearchSuggestion[] = []

    // Recent searches that match
    const matchingRecent = searchHistory
      .filter(item => item.text.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 3)
    suggestions.push(...matchingRecent)

    // Saved searches that match
    const matchingSaved = savedSearches
      .filter(item => item.text.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 2)
    suggestions.push(...matchingSaved)

    // Auto-suggestions based on available data
    const unitSuggestions = availableUnits
      .filter(unit => unit.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 3)
      .map(unit => ({
        text: `Unit: ${unit}`,
        type: 'suggestion' as const,
        filters: { query: '', units: [unit] }
      }))
    suggestions.push(...unitSuggestions)

    // File name suggestions
    const fileSuggestions = availableFiles
      .filter(file => file.name.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 2)
      .map(file => ({
        text: `File: ${file.name}`,
        type: 'suggestion' as const,
        filters: { query: '', fileIds: [file.id] }
      }))
    suggestions.push(...fileSuggestions)

    setSearchSuggestions(suggestions)
  }, [searchHistory, savedSearches, availableUnits, availableFiles])

  // Update suggestions when query changes
  useEffect(() => {
    if (showSuggestions) {
      generateSuggestions(filters.query)
    }
  }, [filters.query, showSuggestions, generateSuggestions])

  // Trigger search when debounced query changes
  useEffect(() => {
    if (debouncedQuery !== filters.query) {
      // Don't trigger search during typing
      return
    }
    
    if (debouncedQuery || hasActiveFilters()) {
      onSearch(filters)
    }
  }, [debouncedQuery, filters, onSearch])

  const hasActiveFilters = () => {
    return Boolean(
      filters.itemId ||
      (filters.units && filters.units.length > 0) ||
      filters.quantityMin !== undefined ||
      filters.quantityMax !== undefined ||
      (filters.fileIds && filters.fileIds.length > 0) ||
      filters.dateRange?.from ||
      filters.dateRange?.to ||
      (filters.categories && filters.categories.length > 0) ||
      filters.hasItemId !== undefined ||
      filters.aggregatedOnly
    )
  }

  const updateFilters = (updates: Partial<SearchFilters>) => {
    const newFilters = { ...filters, ...updates }
    setFilters(newFilters)
    
    // Immediate search for filter changes (not query changes)
    if (!updates.hasOwnProperty('query')) {
      onSearch(newFilters)
    }
  }

  const handleQueryChange = (value: string) => {
    setFilters(prev => ({ ...prev, query: value }))
  }

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    if (suggestion.filters) {
      setFilters(suggestion.filters)
      onSearch(suggestion.filters)
    } else {
      setFilters(prev => ({ ...prev, query: suggestion.text }))
    }
    setShowSuggestions(false)
  }

  const clearAllFilters = () => {
    const resetFilters = { query: '' }
    setFilters(resetFilters)
    onReset()
    setShowSuggestions(false)
  }

  const removeFilter = (filterKey: keyof SearchFilters, value?: any) => {
    const newFilters = { ...filters }
    
    if (filterKey === 'units' && Array.isArray(newFilters.units)) {
      newFilters.units = newFilters.units.filter(u => u !== value)
      if (newFilters.units.length === 0) delete newFilters.units
    } else if (filterKey === 'fileIds' && Array.isArray(newFilters.fileIds)) {
      newFilters.fileIds = newFilters.fileIds.filter(f => f !== value)
      if (newFilters.fileIds.length === 0) delete newFilters.fileIds
    } else if (filterKey === 'categories' && Array.isArray(newFilters.categories)) {
      newFilters.categories = newFilters.categories.filter(c => c !== value)
      if (newFilters.categories.length === 0) delete newFilters.categories
    } else {
      delete newFilters[filterKey]
    }
    
    setFilters(newFilters)
    onSearch(newFilters)
  }

  const getActiveFiltersCount = () => {
    let count = 0
    if (filters.itemId) count++
    if (filters.units?.length) count += filters.units.length
    if (filters.quantityMin !== undefined || filters.quantityMax !== undefined) count++
    if (filters.fileIds?.length) count += filters.fileIds.length
    if (filters.dateRange?.from || filters.dateRange?.to) count++
    if (filters.categories?.length) count += filters.categories.length
    if (filters.hasItemId !== undefined) count++
    if (filters.aggregatedOnly) count++
    return count
  }

  return (
    <div className="space-y-4">
      {/* Main Search Input */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={placeholder}
            value={filters.query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            className="pl-10 pr-20"
          />
          <div className="absolute right-2 top-2 flex gap-1">
            {showAdvanced && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                className="h-7 px-2"
              >
                <Filter className="h-3 w-3" />
                {getActiveFiltersCount() > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                    {getActiveFiltersCount()}
                  </Badge>
                )}
              </Button>
            )}
            {(filters.query || hasActiveFilters()) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="h-7 px-2"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Search Suggestions */}
        {showSuggestions && searchSuggestions.length > 0 && (
          <Card className="absolute top-full left-0 right-0 mt-1 z-50 shadow-lg">
            <CardContent className="p-2">
              <div className="space-y-1">
                {searchSuggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-muted"
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    {suggestion.type === 'recent' && (
                      <Clock className="h-3 w-3 text-muted-foreground" />
                    )}
                    {suggestion.type === 'saved' && (
                      <Star className="h-3 w-3 text-yellow-500" />
                    )}
                    {suggestion.type === 'suggestion' && (
                      <Search className="h-3 w-3 text-muted-foreground" />
                    )}
                    <span className="text-sm">{suggestion.text}</span>
                    {suggestion.count && (
                      <Badge variant="outline" className="ml-auto">
                        {suggestion.count}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters() && (
        <div className="flex flex-wrap gap-2">
          {filters.itemId && (
            <Badge variant="secondary" className="gap-1">
              Item ID: {filters.itemId}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeFilter('itemId')}
                className="h-4 w-4 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
          
          {filters.units?.map(unit => (
            <Badge key={unit} variant="secondary" className="gap-1">
              Unit: {unit}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeFilter('units', unit)}
                className="h-4 w-4 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}

          {(filters.quantityMin !== undefined || filters.quantityMax !== undefined) && (
            <Badge variant="secondary" className="gap-1">
              Quantity: {filters.quantityMin || 0} - {filters.quantityMax || '∞'}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  removeFilter('quantityMin')
                  removeFilter('quantityMax')
                }}
                className="h-4 w-4 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}

          {filters.fileIds?.map(fileId => {
            const file = availableFiles.find(f => f.id === fileId)
            return (
              <Badge key={fileId} variant="secondary" className="gap-1">
                File: {file?.name || fileId}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFilter('fileIds', fileId)}
                  className="h-4 w-4 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )
          })}

          {filters.hasItemId !== undefined && (
            <Badge variant="secondary" className="gap-1">
              {filters.hasItemId ? 'Has Item ID' : 'No Item ID'}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeFilter('hasItemId')}
                className="h-4 w-4 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}

          {filters.aggregatedOnly && (
            <Badge variant="secondary" className="gap-1">
              Aggregated Only
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeFilter('aggregatedOnly')}
                className="h-4 w-4 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
        </div>
      )}

      {/* Advanced Filters */}
      {showAdvanced && (
        <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
          <CollapsibleContent className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Advanced Filters
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Item ID Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Item ID</label>
                  <Input
                    placeholder="Search by specific Item ID"
                    value={filters.itemId || ''}
                    onChange={(e) => updateFilters({ itemId: e.target.value || undefined })}
                  />
                </div>

                {/* Units Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Units</label>
                  <div className="flex flex-wrap gap-2">
                    {availableUnits.map(unit => (
                      <div key={unit} className="flex items-center space-x-2">
                        <Checkbox
                          id={`unit-${unit}`}
                          checked={filters.units?.includes(unit) || false}
                          onCheckedChange={(checked) => {
                            const currentUnits = filters.units || []
                            if (checked) {
                              updateFilters({ units: [...currentUnits, unit] })
                            } else {
                              updateFilters({ 
                                units: currentUnits.filter(u => u !== unit)
                              })
                            }
                          }}
                        />
                        <label
                          htmlFor={`unit-${unit}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {unit}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quantity Range */}
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Calculator className="h-4 w-4" />
                    Quantity Range
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground">Min</label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={filters.quantityMin || ''}
                        onChange={(e) => updateFilters({ 
                          quantityMin: e.target.value ? Number(e.target.value) : undefined 
                        })}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Max</label>
                      <Input
                        type="number"
                        placeholder="No limit"
                        value={filters.quantityMax || ''}
                        onChange={(e) => updateFilters({ 
                          quantityMax: e.target.value ? Number(e.target.value) : undefined 
                        })}
                      />
                    </div>
                  </div>
                </div>

                {/* Files Filter */}
                {availableFiles.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Source Files</label>
                    <Select
                      value=""
                      onValueChange={(value) => {
                        const currentFiles = filters.fileIds || []
                        if (!currentFiles.includes(value)) {
                          updateFilters({ fileIds: [...currentFiles, value] })
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Add file filter..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableFiles
                          .filter(file => !filters.fileIds?.includes(file.id))
                          .map(file => (
                            <SelectItem key={file.id} value={file.id}>
                              {file.name}
                            </SelectItem>
                          ))
                        }
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Additional Options */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="has-item-id"
                      checked={filters.hasItemId === true}
                      onCheckedChange={(checked) => {
                        updateFilters({ 
                          hasItemId: checked ? true : undefined 
                        })
                      }}
                    />
                    <label
                      htmlFor="has-item-id"
                      className="text-sm font-medium leading-none"
                    >
                      Items with Item ID only
                    </label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="aggregated-only"
                      checked={filters.aggregatedOnly || false}
                      onCheckedChange={(checked) => {
                        updateFilters({ aggregatedOnly: checked === true ? true : undefined })
                      }}
                    />
                    <label
                      htmlFor="aggregated-only"
                      className="text-sm font-medium leading-none"
                    >
                      Show aggregated items only
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  )
}