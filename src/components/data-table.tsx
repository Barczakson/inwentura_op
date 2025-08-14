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
import { Edit, Trash2, ArrowUpDown, Search } from 'lucide-react'
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
}

export function DataTable({ data, onEdit, onDelete, showAggregated = false, uploadedFiles = [] }: DataTableProps) {
  console.log('DataTable received:', { data, showAggregated, uploadedFiles })
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

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-2">
                  Name
                  <ArrowUpDown className="w-4 h-4" />
                </div>
              </TableHead>
              {!showAggregated && (
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-2">
                    ID
                    <ArrowUpDown className="w-4 h-4" />
                  </div>
                </TableHead>
              )}
              {showAggregated && (
                <TableHead>Source Files</TableHead>
              )}
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('quantity')}
              >
                <div className="flex items-center gap-2">
                  Quantity
                  <ArrowUpDown className="w-4 h-4" />
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('unit')}
              >
                <div className="flex items-center gap-2">
                  Unit
                  <ArrowUpDown className="w-4 h-4" />
                </div>
              </TableHead>
              {showAggregated && (
                <TableHead>Count</TableHead>
              )}
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showAggregated ? 6 : 6} className="text-center py-8">
                  No data found
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedData.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  {!showAggregated && (
                    <TableCell>
                      {item.itemId ? (
                        <Badge variant="secondary">{item.itemId}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  )}
                  {showAggregated && (
                    <TableCell>
                      <div className="max-w-[200px]">
                        {item.sourceFiles && item.sourceFiles.length > 0 ? (
                          <div className="space-y-1">
                            {item.sourceFiles.slice(0, 2).map((fileId) => (
                              <Badge key={`file-${fileId}`} variant="outline" className="text-xs">
                                {getFileName(fileId)}
                              </Badge>
                            ))}
                            {item.sourceFiles.length > 2 && (
                              <Badge key="more-files" variant="secondary" className="text-xs">
                                +{item.sourceFiles.length - 2} more
                              </Badge>
                            )}
                          </div>
                        ) : item.fileId ? (
                          <Badge variant="outline" className="text-xs">
                            {getFileName(item.fileId)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">Manual entry</span>
                        )}
                      </div>
                    </TableCell>
                  )}
                  <TableCell className="font-mono">
                    {formatQuantityWithConversion(item.quantity, item.unit)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{item.unit}</Badge>
                  </TableCell>
                  {showAggregated && (
                    <TableCell>
                      <Badge variant="secondary">
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