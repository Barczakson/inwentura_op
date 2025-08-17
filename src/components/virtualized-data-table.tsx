'use client'

import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef, useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Edit, Trash2, ArrowUpDown, FileSpreadsheet } from 'lucide-react'
import { formatQuantityWithConversion } from '@/lib/unit-conversion'
import { abbreviateFileName, getFileColorClass, getFileBackgroundColor, getFileBorderColor, getFileInlineStyle } from '@/lib/colors'

interface VirtualizedDataTableProps {
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
  onStartInlineEdit?: (itemId: string, currentQuantity: number) => void
  onCancelInlineEdit?: () => void
  onSaveInlineEdit?: (itemId: string) => void
  inlineEditingItem?: string | null
  inlineEditValue?: string
  onInlineEditValueChange?: (value: string) => void
  
  // Virtualization settings
  overscan?: number
  estimateSize?: () => number
}

export function VirtualizedDataTable({ 
  data, 
  onEdit, 
  onDelete, 
  showAggregated = false, 
  uploadedFiles = [],
  onStartInlineEdit,
  onCancelInlineEdit,
  onSaveInlineEdit,
  inlineEditingItem = null,
  inlineEditValue = '',
  onInlineEditValueChange,
  overscan = 10,
  estimateSize = () => 60 // Estimated row height in pixels
}: VirtualizedDataTableProps) {
  const parentRef = useRef<HTMLDivElement>(null)

  // Get file name by ID
  const getFileName = (fileId: string) => {
    const file = uploadedFiles.find(f => f.id === fileId)
    return file ? file.name : 'Unknown File'
  }

  // Memoize data to prevent unnecessary re-renders
  const memoizedData = useMemo(() => data, [data])

  const rowVirtualizer = useVirtualizer({
    count: memoizedData.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan,
  })

  const items = rowVirtualizer.getVirtualItems()

  // Define column configurations
  const columns = useMemo(() => {
    const cols = [
      {
        key: 'name',
        header: 'Name',
        width: 'min-w-[200px]',
        render: (item: any) => (
          <div>
            <div className="truncate pr-2 font-medium">{item.name}</div>
            {/* Show unit on smaller screens */}
            <div className="md:hidden">
              <Badge variant="outline" className="text-xs mt-1">{item.unit}</Badge>
            </div>
          </div>
        )
      }
    ]

    // Add ID column for raw data
    if (!showAggregated) {
      cols.push({
        key: 'itemId',
        header: 'ID',
        width: 'hidden sm:table-cell min-w-[100px]',
        render: (item: any) => (
          item.itemId ? (
            <Badge variant="secondary" className="text-xs">{item.itemId}</Badge>
          ) : (
            <span className="text-muted-foreground">-</span>
          )
        )
      })
    }

    // Add source files column for aggregated data
    if (showAggregated) {
      cols.push({
        key: 'sourceFiles',
        header: 'Source Files',
        width: 'hidden lg:table-cell min-w-[200px]',
        render: (item: any) => (
          <div className="max-w-[180px]">
            {item.sourceFiles && item.sourceFiles.length > 0 ? (
              <div className="space-y-1">
                {item.sourceFiles.slice(0, 2).map((fileId: string, index: number) => (
                  <Badge key={`${item.id}-file-${fileId}-${index}`} variant="outline" className="text-xs block" title={getFileName(fileId)}>
                    <div className="flex items-center gap-1">
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
                  <Badge variant="secondary" className="text-xs">
                    +{item.sourceFiles.length - 2} więcej
                  </Badge>
                )}
              </div>
            ) : item.fileId ? (
              <Badge variant="outline" className="text-xs" title={getFileName(item.fileId)}>
                <div className="flex items-center gap-1">
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
        )
      })
    }

    // Add quantity column
    cols.push({
      key: 'quantity',
      header: 'Quantity',
      width: 'min-w-[120px]',
      render: (item: any) => (
        <div
          className="cursor-pointer hover:bg-muted/50 p-1 rounded text-sm font-mono"
          onClick={() => onStartInlineEdit?.(item.id, item.quantity)}
          title="Kliknij, aby edytować ilość"
        >
          <div className="truncate">
            {formatQuantityWithConversion(item.quantity, item.unit)}
          </div>
        </div>
      )
    })

    // Add unit column
    cols.push({
      key: 'unit',
      header: 'Unit',
      width: 'hidden md:table-cell min-w-[80px]',
      render: (item: any) => (
        <Badge variant="outline" className="text-xs">{item.unit}</Badge>
      )
    })

    // Add count column for aggregated data
    if (showAggregated) {
      cols.push({
        key: 'count',
        header: 'Count',
        width: 'hidden sm:table-cell min-w-[80px]',
        render: (item: any) => (
          <Badge variant="secondary" className="text-xs">
            {item.count || data.filter(d => d.name === item.name && d.unit === item.unit).length}
          </Badge>
        )
      })
    }

    // Add actions column
    cols.push({
      key: 'actions',
      header: 'Actions',
      width: 'w-[120px] min-w-[120px]',
      render: (item: any) => (
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
      )
    })

    return cols
  }, [showAggregated, data, uploadedFiles, onEdit, onDelete, onStartInlineEdit])

  if (memoizedData.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Brak danych do wyświetlenia</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Virtual table container */}
      <div
        ref={parentRef}
        className="h-[600px] overflow-auto border rounded-md"
        style={{
          contain: 'strict',
        }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          <Table className="min-w-full">
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                {columns.map((column) => (
                  <TableHead key={column.key} className={column.width}>
                    <div className="flex items-center gap-2">
                      <span className="truncate">{column.header}</span>
                      {['name', 'quantity', 'unit'].includes(column.key) && (
                        <ArrowUpDown className="w-4 h-4 flex-shrink-0" />
                      )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((virtualRow) => {
                const item = memoizedData[virtualRow.index]
                const isEven = virtualRow.index % 2 === 0

                return (
                  <TableRow
                    key={item.id}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    className={`
                      hover:bg-muted/50 
                      ${isEven ? 'bg-background' : 'bg-muted/20'}
                      ${item.fileId ? getFileBorderColor(item.fileId) : 
                        (item.sourceFiles && item.sourceFiles.length > 0 ? 
                         getFileBorderColor(item.sourceFiles[0]) : '')}
                    `}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {columns.map((column) => (
                      <TableCell key={column.key} className={column.width}>
                        {column.render(item)}
                      </TableCell>
                    ))}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Performance info */}
      <div className="text-xs text-muted-foreground text-center">
        📊 Virtualizacja aktywna: wyświetlane {items.length} z {memoizedData.length} wierszy
      </div>
    </div>
  )
}