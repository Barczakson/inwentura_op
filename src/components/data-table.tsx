'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Edit, Trash2, ArrowUpDown, Search, CheckSquare, Square, ChevronUp, ChevronDown, FileSpreadsheet, Circle, Check, X } from 'lucide-react'
import { useState, useMemo, useEffect } from 'react'
import { formatQuantityWithConversion } from '@/lib/unit-conversion'
import { abbreviateFileName, getFileColorClass, getFileBackgroundColor, getFileBorderColor, getFileInlineStyle } from '@/lib/colors'
import { useDebounce } from '@/hooks/use-debounce'
import { VirtualizedDataTable } from './virtualized-data-table'
import { 
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'

interface DataTableProps {
  data: Array<{
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
    isDuplicate?: boolean
    duplicateCount?: number
    originalIndex?: number
  }>
  onEdit?: (id: string) => void
  onDelete?: (id: string) => void
  showAggregated?: boolean
  uploadedFiles?: Array<{
    id: string
    name: string
  }>
  bulkEditMode?: boolean
  selectedItems?: Set<string>
  onSelectItem?: (id: string) => void
  onSelectAll?: () => void
  inlineEditingItem?: string | null
  inlineEditValue?: string
  onStartInlineEdit?: (itemId: string, currentQuantity: number) => void
  onCancelInlineEdit?: () => void
  onSaveInlineEdit?: (itemId: string) => void
  onInlineEditValueChange?: (value: string) => void
  groupedByFile?: boolean // New prop for file grouping
  // Pagination props
  paginationState?: {
    page: number
    limit: number
    search: string
    sortBy: string
    sortDirection: 'asc' | 'desc'
  }
  paginationMeta?: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
  onPaginationChange?: {
    setPage: (page: number) => void
    setLimit: (limit: number) => void
    setSearch: (search: string) => void
    setSorting: (sortBy: string, direction: 'asc' | 'desc') => void
  }
  isLoading?: boolean
  // Virtualization
  virtualizationThreshold?: number // Use virtualization when data.length > threshold
  enableVirtualization?: boolean // Force enable/disable virtualization
}

export function DataTable({ 
  data, 
  onEdit, 
  onDelete, 
  showAggregated = false, 
  uploadedFiles = [],
  bulkEditMode = false,
  selectedItems = new Set(),
  onSelectItem,
  onSelectAll,
  inlineEditingItem = null,
  inlineEditValue = '',
  onStartInlineEdit,
  onCancelInlineEdit,
  onSaveInlineEdit,
  onInlineEditValueChange,
  groupedByFile = false, // New prop
  paginationState,
  paginationMeta,
  onPaginationChange,
  isLoading = false,
  virtualizationThreshold = 100,
  enableVirtualization
}: DataTableProps) {
  const [searchTerm, setSearchTerm] = useState(paginationState?.search || '')
  const [sortColumn, setSortColumn] = useState<'name' | 'quantity' | 'unit'>((paginationState?.sortBy as any) || 'name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(paginationState?.sortDirection || 'asc')
  const [unitFilter, setUnitFilter] = useState<string>('all')
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set()) // For file grouping
  
  // Use server-side search if pagination callbacks are available
  const useServerSideSearch = !!onPaginationChange
  
  // Debounce search term to improve performance
  const debouncedSearchTerm = useDebounce(searchTerm, 300)
  
  // Check if virtualization should be used
  const shouldUseVirtualization = useMemo(() => {
    if (enableVirtualization !== undefined) {
      return enableVirtualization
    }
    
    const threshold = virtualizationThreshold || 100
    return data.length > threshold && !groupedByFile && !useServerSideSearch
  }, [data.length, enableVirtualization, virtualizationThreshold, groupedByFile, useServerSideSearch])
  
  // Update server search when debounced term changes
  useEffect(() => {
    if (useServerSideSearch && onPaginationChange && debouncedSearchTerm !== paginationState?.search) {
      onPaginationChange.setSearch(debouncedSearchTerm)
    }
  }, [debouncedSearchTerm, useServerSideSearch, onPaginationChange, paginationState?.search])

  // Group data by file if requested
  const groupedData = useMemo(() => {
    if (!groupedByFile) return null;
    
    const groups: Record<string, typeof data> = {};
    
    data.forEach(item => {
      // For aggregated data, we might have multiple source files
      if (showAggregated && item.sourceFiles && item.sourceFiles.length > 0) {
        item.sourceFiles.forEach(fileId => {
          if (!groups[fileId]) groups[fileId] = [];
          // Check if item is already in this group to avoid duplicates
          const exists = groups[fileId].some(groupItem => groupItem.id === item.id);
          if (!exists) {
            groups[fileId].push(item);
          }
        });
      } 
      // For raw data or aggregated with single source
      else {
        const fileId = item.fileId || 'manual';
        if (!groups[fileId]) groups[fileId] = [];
        groups[fileId].push(item);
      }
    });
    
    return groups;
  }, [data, groupedByFile, showAggregated]);

  // Filter and sort data (for non-grouped view)
  const filteredAndSortedData = useMemo(() => {
    if (groupedByFile) return []; // Not used in grouped view
    
    let filtered = data.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        (item.itemId && item.itemId.toLowerCase().includes(debouncedSearchTerm.toLowerCase()))
      const matchesUnit = unitFilter === 'all' || item.unit === unitFilter
      return matchesSearch && matchesUnit
    })

    filtered.sort((a, b) => {
      let aValue: any, bValue: any
      
      switch (sortColumn) {
        case 'name':
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
          break
        case 'quantity':
          // Convert to common unit for comparison
          try {
            aValue = convertToCommonUnit(a.quantity, a.unit)
            bValue = convertToCommonUnit(b.quantity, b.unit)
          } catch {
            aValue = a.quantity
            bValue = b.quantity
          }
          break
        case 'unit':
          aValue = a.unit.toLowerCase()
          bValue = b.unit.toLowerCase()
          break
        default:
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
      }

      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
      }
    })

    return filtered
  }, [data, debouncedSearchTerm, sortColumn, sortDirection, unitFilter, groupedByFile])


  const handleSort = (column: 'name' | 'quantity' | 'unit') => {
    const newDirection = sortColumn === column ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'asc'
    
    if (useServerSideSearch && onPaginationChange) {
      // Use server-side sorting
      onPaginationChange.setSorting(column, newDirection)
    } else {
      // Use client-side sorting
      setSortColumn(column)
      setSortDirection(newDirection)
    }
  }

  // Toggle file group expansion
  const toggleFileGroup = (fileId: string) => {
    const newExpanded = new Set(expandedFiles);
    if (newExpanded.has(fileId)) {
      newExpanded.delete(fileId);
    } else {
      newExpanded.add(fileId);
    }
    setExpandedFiles(newExpanded);
  }

  // Get file name by ID
  const getFileName = (fileId: string) => {
    const file = uploadedFiles.find(f => f.id === fileId)
    return file ? file.name : 'Unknown File'
  }

  // Convert quantity to a common unit (grams for weight, ml for volume) for comparison
  const convertToCommonUnit = (quantity: number, unit: string): number => {
    const normalizedUnit = unit.toLowerCase()
    
    // Weight units - convert to grams
    if (['g', 'kg', 'mg', 'oz', 'lb'].includes(normalizedUnit)) {
      switch (normalizedUnit) {
        case 'kg': return quantity * 1000
        case 'mg': return quantity / 1000
        case 'oz': return quantity * 28.3495
        case 'lb': return quantity * 453.592
        default: return quantity // grams
      }
    }
    
    // Volume units - convert to milliliters
    if (['l', 'ml', 'fl oz', 'gal', 'cup'].includes(normalizedUnit)) {
      switch (normalizedUnit) {
        case 'l': return quantity * 1000
        case 'fl oz': return quantity * 29.5735
        case 'gal': return quantity * 3785.41
        case 'cup': return quantity * 236.588
        default: return quantity // milliliters
      }
    }
    
    return quantity
  }

  const uniqueUnits = useMemo(() => {
    const units = [...new Set(data.map(item => item.unit))]
    return units.sort()
  }, [data])

  // Render table for grouped data
  const renderGroupedTable = () => {
    if (!groupedData) return null;

    return (
      <div className="space-y-6">
        {Object.entries(groupedData).map(([fileId, items]) => {
          const fileName = getFileName(fileId);
          const isExpanded = expandedFiles.has(fileId);
          const fileItems = items || [];
          
          return (
            <div key={fileId} className="border rounded-lg">
              {/* File Group Header */}
              <div 
                className={`flex items-center justify-between p-4 cursor-pointer hover:bg-muted/70 ${getFileBorderColor(fileId)}`}
                onClick={() => toggleFileGroup(fileId)}
              >
                <div className="flex items-center gap-3">
                  {/* Color indicator circle */}
                  <div 
                    className="w-4 h-4 rounded-full border-2 shadow"
                    style={{
                      ...getFileInlineStyle(fileId),
                      borderColor: '#ffffff'
                    }}
                  ></div>
                  <FileSpreadsheet className="w-5 h-5 text-blue-500" />
                  <div>
                    <h3 className="font-medium">{fileName}</h3>
                    <p className="text-sm text-muted-foreground">
                      {fileItems.length} {fileItems.length === 1 ? 'element' : 'elementów'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              
              {/* File Group Content */}
              {isExpanded && (
                <div className="p-4 border-t">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {bulkEditMode && (
                          <TableHead className="w-[50px]">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={onSelectAll}
                              className="p-0 h-6 w-6"
                            >
                              {selectedItems.size === fileItems.length && fileItems.length > 0 ? (
                                <CheckSquare className="w-4 h-4" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </Button>
                          </TableHead>
                        )}
                        <TableHead className="cursor-pointer hover:bg-muted/50 min-w-[120px]">
                          <div className="flex items-center gap-2">
                            <span className="truncate">Name</span>
                          </div>
                        </TableHead>
                        {!showAggregated && (
                          <TableHead className="cursor-pointer hover:bg-muted/50 hidden sm:table-cell min-w-[80px]">
                            <div className="flex items-center gap-2">
                              <span className="truncate">ID</span>
                            </div>
                          </TableHead>
                        )}
                        <TableHead className="cursor-pointer hover:bg-muted/50 min-w-[100px]">
                          <div className="flex items-center gap-2">
                            <span className="truncate">Quantity</span>
                          </div>
                        </TableHead>
                        <TableHead className="cursor-pointer hover:bg-muted/50 hidden md:table-cell min-w-[70px]">
                          <div className="flex items-center gap-2">
                            <span className="truncate">Unit</span>
                          </div>
                        </TableHead>
                        {showAggregated && (
                          <TableHead className="hidden sm:table-cell min-w-[70px]">Count</TableHead>
                        )}
                        <TableHead className="w-[80px] min-w-[80px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fileItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={bulkEditMode ? (showAggregated ? 7 : 7) : (showAggregated ? 6 : 6)} className="text-center py-8">
                            Nie znaleziono danych
                          </TableCell>
                        </TableRow>
                      ) : (
                        fileItems.map((item) => (
                          <TableRow 
                            key={item.id}
                            className={`hover:bg-muted/50 ${item.fileId ? getFileBorderColor(item.fileId) : 
                                     (item.sourceFiles && item.sourceFiles.length > 0 ? 
                                      getFileBorderColor(item.sourceFiles[0]) : '')}`}
                          >
                            {bulkEditMode && (
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onSelectItem?.(item.id)}
                                  className="p-0 h-6 w-6"
                                >
                                  {selectedItems.has(item.id) ? (
                                    <CheckSquare className="w-4 h-4 text-primary" />
                                  ) : (
                                    <Square className="w-4 h-4" />
                                  )}
                                </Button>
                              </TableCell>
                            )}
                            <TableCell className="font-medium min-w-[120px]">
                              <div>
                                  <div className="truncate pr-2">{item.name}</div>
                                  {/* Show unit on mobile when Unit column is hidden */}
                                  <div className="md:hidden">
                                    <Badge variant="outline" className="text-xs mt-1">{item.unit}</Badge>
                                  </div>
                                  {/* Show aggregation indicator */}
                                  {(item.isAggregated || (item.sourceFiles && item.sourceFiles.length > 1)) && (
                                    <Badge variant="secondary" className="text-xs mt-1">
                                      <div className="flex items-center gap-1">
                                        <FileSpreadsheet className="w-3 h-3" />
                                        <span>Zagregowane z {item.sourceFiles?.length || 0} plików</span>
                                      </div>
                                    </Badge>
                                  )}
                              </div>
                            </TableCell>
                            {!showAggregated && (
                              <TableCell className="hidden sm:table-cell">
                                {item.itemId ? (
                                  <Badge variant="secondary" className="text-xs">{item.itemId}</Badge>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            )}
                            <TableCell className="font-mono min-w-[100px]">
                              {inlineEditingItem === item.id ? (
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="number"
                                    value={inlineEditValue}
                                    onChange={(e) => onInlineEditValueChange?.(e.target.value)}
                                    className="w-16 h-8 text-xs"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        onSaveInlineEdit?.(item.id)
                                      } else if (e.key === 'Escape') {
                                        onCancelInlineEdit?.()
                                      }
                                    }}
                                  />
                                  <Button
                                    size="sm"
                                    onClick={() => onSaveInlineEdit?.(item.id)}
                                    className="h-6 px-1 text-xs"
                                  >
                                    <Check className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={onCancelInlineEdit}
                                    className="h-6 px-1 text-xs"
                                  >
                                    <X className="w-3 h-3" />
                                  </Button>
                                </div>
                              ) : (
                                <div
                                  className="cursor-pointer hover:bg-muted/50 p-1 rounded text-sm"
                                  onClick={() => onStartInlineEdit?.(item.id, item.quantity)}
                                  title="Kliknij, aby edytować ilość"
                                >
                                  <div className="truncate">
                                    {formatQuantityWithConversion(item.quantity, item.unit)}
                                  </div>
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <Badge variant="outline" className="text-xs">{item.unit}</Badge>
                            </TableCell>
                            {showAggregated && (
                              <TableCell className="hidden sm:table-cell">
                                <Badge variant="secondary" className="text-xs">
                                  {item.count || data.filter(d => d.name === item.name && d.unit === item.unit).length}
                                </Badge>
                              </TableCell>
                            )}
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {onEdit && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onEdit(item.id)}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                )}
                                {onDelete && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onDelete(item.id)}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Render table for non-grouped data
  const renderRegularTable = () => (
    <div className="rounded-md border overflow-x-auto">
      <Table className="min-w-full">
        <TableHeader>
          <TableRow>
            {bulkEditMode && (
              <TableHead className="w-[50px]">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onSelectAll}
                  className="p-0 h-6 w-6"
                >
                  {selectedItems.size === filteredAndSortedData.length && filteredAndSortedData.length > 0 ? (
                    <CheckSquare className="w-4 h-4" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </Button>
              </TableHead>
            )}
            <TableHead 
              className="cursor-pointer hover:bg-muted/50 min-w-[120px]"
              onClick={() => handleSort('name')}
            >
              <div className="flex items-center gap-2">
                <span className="truncate">Name</span>
                <ArrowUpDown className="w-4 h-4 flex-shrink-0" />
              </div>
            </TableHead>
            {!showAggregated && (
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 hidden sm:table-cell min-w-[80px]"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-2">
                  <span className="truncate">ID</span>
                  <ArrowUpDown className="w-4 h-4 flex-shrink-0" />
                </div>
              </TableHead>
            )}
            {showAggregated && (
              <TableHead className="hidden lg:table-cell min-w-[200px]">Source Files</TableHead>
            )}
            <TableHead 
              className="cursor-pointer hover:bg-muted/50 min-w-[100px]"
              onClick={() => handleSort('quantity')}
            >
              <div className="flex items-center gap-2">
                <span className="truncate">Quantity</span>
                <ArrowUpDown className="w-4 h-4 flex-shrink-0" />
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-muted/50 hidden md:table-cell min-w-[70px]"
              onClick={() => handleSort('unit')}
            >
              <div className="flex items-center gap-2">
                <span className="truncate">Unit</span>
                <ArrowUpDown className="w-4 h-4 flex-shrink-0" />
              </div>
            </TableHead>
            {showAggregated && (
              <TableHead className="hidden sm:table-cell min-w-[70px]">Count</TableHead>
            )}
            <TableHead className="w-[80px] min-w-[80px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredAndSortedData.length === 0 ? (
            <TableRow>
              <TableCell colSpan={bulkEditMode ? (showAggregated ? 7 : 7) : (showAggregated ? 6 : 6)} className="text-center py-8">
                Nie znaleziono danych
              </TableCell>
            </TableRow>
          ) : (
                      filteredAndSortedData.map((item) => (
            <TableRow 
              key={item.id}
              className={`hover:bg-muted/50 ${item.fileId ? getFileBorderColor(item.fileId) : 
                       (item.sourceFiles && item.sourceFiles.length > 0 ? 
                        getFileBorderColor(item.sourceFiles[0]) : '')}`}
            >
              {bulkEditMode && (
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onSelectItem?.(item.id)}
                    className="p-0 h-6 w-6"
                  >
                    {selectedItems.has(item.id) ? (
                      <CheckSquare className="w-4 h-4 text-primary" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </Button>
                </TableCell>
              )}
              <TableCell className="font-medium min-w-[120px]">
                <div>
                  <div className="truncate pr-2">{item.name}</div>
                    {/* Show unit on mobile when Unit column is hidden */}
                    <div className="md:hidden">
                      <Badge variant="outline" className="text-xs mt-1">{item.unit}</Badge>
                    </div>
                  </div>
              </TableCell>
              {!showAggregated && (
                <TableCell className="hidden sm:table-cell">
                  {item.itemId ? (
                    <Badge variant="secondary" className="text-xs">{item.itemId}</Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
              )}
              {showAggregated && (
                <TableCell className="hidden lg:table-cell min-w-[200px]">
                  <div className="max-w-[180px]">
                    {item.sourceFiles && item.sourceFiles.length > 0 ? (
                      <div className="space-y-1">
                        {item.sourceFiles.slice(0, 2).map((fileId, index) => (
                          <Badge key={`${item.id}-file-${fileId}-${index}`} variant="outline" className="text-xs block" title={getFileName(fileId)}>
                            <div className="flex items-center gap-1">
                              {/* Color indicator circle */}
                              <div 
                                className="w-3 h-3 rounded-full border"
                                style={{
                                  ...getFileInlineStyle(fileId),
                                  borderColor: '#ffffff'
                                }}
                              ></div>
                              <FileSpreadsheet className="w-3 h-3" />
                              <span className="truncate">{abbreviateFileName(getFileName(fileId), 15)}</span>
                            </div>
                          </Badge>
                        ))}
                        {item.sourceFiles.length > 2 && (
                          <Badge key={`${item.id}-more-files`} variant="secondary" className="text-xs">
                            +{item.sourceFiles.length - 2} więcej
                          </Badge>
                        )}
                      </div>
                    ) : item.fileId ? (
                      <Badge variant="outline" className="text-xs" title={getFileName(item.fileId)}>
                        <div className="flex items-center gap-1">
                          {/* Color indicator circle */}
                          <div 
                            className="w-3 h-3 rounded-full border"
                            style={{
                              ...getFileInlineStyle(item.fileId),
                              borderColor: '#ffffff'
                            }}
                          ></div>
                          <FileSpreadsheet className="w-3 h-3" />
                          <span className="truncate">{abbreviateFileName(getFileName(item.fileId), 15)}</span>
                        </div>
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs flex items-center gap-1">
                        <FileSpreadsheet className="w-3 h-3" />
                        <span>Ręczny</span>
                      </span>
                    )}
                  </div>
                </TableCell>
              )}
              <TableCell className="font-mono min-w-[100px]">
                {inlineEditingItem === item.id ? (
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      value={inlineEditValue}
                      onChange={(e) => onInlineEditValueChange?.(e.target.value)}
                      className="w-16 h-8 text-xs"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          onSaveInlineEdit?.(item.id)
                        } else if (e.key === 'Escape') {
                          onCancelInlineEdit?.()
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      onClick={() => onSaveInlineEdit?.(item.id)}
                      className="h-6 px-1 text-xs"
                    >
                      <Check className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={onCancelInlineEdit}
                      className="h-6 px-1 text-xs"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <div
                    className="cursor-pointer hover:bg-muted/50 p-1 rounded text-sm"
                    onClick={() => onStartInlineEdit?.(item.id, item.quantity)}
                    title="Kliknij, aby edytować ilość"
                  >
                    <div className="truncate">
                      {formatQuantityWithConversion(item.quantity, item.unit)}
                    </div>
                  </div>
                )}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <Badge variant="outline" className="text-xs">{item.unit}</Badge>
              </TableCell>
              {showAggregated && (
                <TableCell className="hidden sm:table-cell">
                  <Badge variant="secondary" className="text-xs">
                    {item.count || data.filter(d => d.name === item.name && d.unit === item.unit).length}
                  </Badge>
                </TableCell>
              )}
              <TableCell>
                <div className="flex items-center gap-2">
                  {onEdit && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(item.id)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onDelete(item.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Szukaj po nazwie lub ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={unitFilter} onValueChange={setUnitFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filtruj według jednostki" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie jednostki</SelectItem>
            {uniqueUnits.map(unit => (
              <SelectItem key={unit} value={unit}>
                {unit}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-2 text-muted-foreground">Ładowanie danych...</span>
        </div>
      ) : groupedByFile ? (
        renderGroupedTable()
      ) : shouldUseVirtualization ? (
        <VirtualizedDataTable
          data={filteredAndSortedData}
          onEdit={onEdit}
          onDelete={onDelete}
          showAggregated={showAggregated}
          uploadedFiles={uploadedFiles}
          onStartInlineEdit={onStartInlineEdit}
          onCancelInlineEdit={onCancelInlineEdit}
          onSaveInlineEdit={onSaveInlineEdit}
          inlineEditingItem={inlineEditingItem}
          inlineEditValue={inlineEditValue}
          onInlineEditValueChange={onInlineEditValueChange}
        />
      ) : (
        renderRegularTable()
      )}

      {/* Pagination */}
      {paginationMeta && onPaginationChange && !groupedByFile && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Wyświetlono {((paginationMeta.page - 1) * paginationMeta.limit) + 1} - {Math.min(paginationMeta.page * paginationMeta.limit, paginationMeta.total)} z {paginationMeta.total} elementów
          </div>
          
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => paginationMeta.hasPrev && onPaginationChange.setPage(paginationMeta.page - 1)}
                  className={!paginationMeta.hasPrev ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
              
              {/* Page numbers */}
              {Array.from({ length: Math.min(5, paginationMeta.totalPages) }, (_, i) => {
                const pageNumber = Math.max(1, paginationMeta.page - 2) + i
                if (pageNumber > paginationMeta.totalPages) return null
                
                return (
                  <PaginationItem key={pageNumber}>
                    <PaginationLink
                      onClick={() => onPaginationChange.setPage(pageNumber)}
                      isActive={pageNumber === paginationMeta.page}
                      className="cursor-pointer"
                    >
                      {pageNumber}
                    </PaginationLink>
                  </PaginationItem>
                )
              })}
              
              <PaginationItem>
                <PaginationNext 
                  onClick={() => paginationMeta.hasNext && onPaginationChange.setPage(paginationMeta.page + 1)}
                  className={!paginationMeta.hasNext ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
          
          {/* Items per page selector */}
          <Select value={paginationMeta.limit.toString()} onValueChange={(value) => onPaginationChange.setLimit(parseInt(value))}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Summary for non-paginated views */}
      {!paginationMeta && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Wyświetlono {groupedByFile ? data.length : filteredAndSortedData.length} z {data.length} elementów
          </span>
          <span>
            Łącznie unikalnych elementów: {uniqueUnits.length}
          </span>
        </div>
      )}
    </div>
  )
}