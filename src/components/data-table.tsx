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
import { Edit, Trash2, ArrowUpDown, Search, CheckSquare, Square } from 'lucide-react'
import { useState, useMemo } from 'react'
import { formatQuantityWithConversion } from '@/lib/unit-conversion'

interface DataTableProps {
  data: Array<{
    id: string
    itemId?: string
    name: string
    quantity: number
    unit: string
    fileId?: string
    sourceFiles?: string[]
    count?: number
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
  onInlineEditValueChange
}: DataTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortColumn, setSortColumn] = useState<'name' | 'quantity' | 'unit'>('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [unitFilter, setUnitFilter] = useState<string>('all')

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    let filtered = data.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.itemId && item.itemId.toLowerCase().includes(searchTerm.toLowerCase()))
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
  }, [data, searchTerm, sortColumn, sortDirection, unitFilter])

  console.log('Filtered and sorted data:', filteredAndSortedData)

  const handleSort = (column: 'name' | 'quantity' | 'unit') => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
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

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search by name or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={unitFilter} onValueChange={setUnitFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by unit" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Units</SelectItem>
            {uniqueUnits.map(unit => (
              <SelectItem key={unit} value={unit}>
                {unit}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table - Mobile First Responsive */}
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
                <TableHead className="hidden lg:table-cell min-w-[150px]">Source Files</TableHead>
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
                  No data found
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedData.map((item) => (
                <TableRow key={item.id}>
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
                    <div className="truncate pr-2">{item.name}</div>
                    {/* Show unit on mobile when Unit column is hidden */}
                    <div className="md:hidden">
                      <Badge variant="outline" className="text-xs mt-1">{item.unit}</Badge>
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
                    <TableCell className="hidden lg:table-cell">
                      <div className="max-w-[150px]">
                        {item.sourceFiles && item.sourceFiles.length > 0 ? (
                          <div className="space-y-1">
                            {item.sourceFiles.slice(0, 1).map((fileId, index) => (
                              <Badge key={`${item.id}-file-${fileId}-${index}`} variant="outline" className="text-xs block">
                                <span className="truncate">{getFileName(fileId)}</span>
                              </Badge>
                            ))}
                            {item.sourceFiles.length > 1 && (
                              <Badge key={`${item.id}-more-files`} variant="secondary" className="text-xs">
                                +{item.sourceFiles.length - 1} more
                              </Badge>
                            )}
                          </div>
                        ) : item.fileId ? (
                          <Badge variant="outline" className="text-xs">
                            <span className="truncate">{getFileName(item.fileId)}</span>
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">Manual</span>
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
                          ✓
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={onCancelInlineEdit}
                          className="h-6 px-1 text-xs"
                        >
                          ✕
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

      {/* Summary */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {filteredAndSortedData.length} of {data.length} items
        </span>
        <span>
          Total unique items: {uniqueUnits.length}
        </span>
      </div>
    </div>
  )
}