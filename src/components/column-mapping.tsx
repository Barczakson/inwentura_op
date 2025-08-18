'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Info } from 'lucide-react'
import * as XLSX from 'xlsx'

interface ColumnMappingProps {
  file: File
  onMappingComplete: (mapping: { 
    itemIdColumn?: number, 
    nameColumn: number, 
    quantityColumn: number, 
    unitColumn: number,
    headerRow: number
  }) => void
  onCancel: () => void
}

interface ColumnInfo {
  index: number
  header?: string
  sampleValues: string[]
}

export function ColumnMapping({ file, onMappingComplete, onCancel }: ColumnMappingProps) {
  const [columns, setColumns] = useState<ColumnInfo[]>([])
  const [headerRow, setHeaderRow] = useState<number>(0)
  const [itemIdColumn, setItemIdColumn] = useState<number | undefined>(undefined)
  const [nameColumn, setNameColumn] = useState<number>(-1)
  const [quantityColumn, setQuantityColumn] = useState<number>(-1)
  const [unitColumn, setUnitColumn] = useState<number>(-1)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    analyzeFileStructure()
  }, [file])

  const analyzeFileStructure = async () => {
    setLoading(true)
    setError(null)
    
    try {
      // In a real implementation, we would send the file to our API to analyze its structure
      // For now, we'll simulate this with a mock implementation
      
      // Create a temporary URL for the file
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      
      // Get the first sheet
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      
      // Convert to JSON with header detection
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
      
      if (jsonData.length === 0) {
        throw new Error('Empty Excel file')
      }
      
      // Extract column information
      const columnInfo: ColumnInfo[] = []
      
      // Determine the maximum number of columns
      const maxColumns = Math.max(...jsonData.map(row => Array.isArray(row) ? row.length : 0))
      
      // Create column info for each column
      for (let i = 0; i < maxColumns; i++) {
        const sampleValues: string[] = []
        
        // Get sample values from first few rows
        for (let j = 0; j < Math.min(5, jsonData.length); j++) {
          const row = jsonData[j]
          if (Array.isArray(row) && row.length > i && row[i] !== null && row[i] !== undefined) {
            sampleValues.push(String(row[i]))
          }
        }
        
        columnInfo.push({
          index: i,
          sampleValues: sampleValues.slice(0, 3) // Limit to 3 sample values
        })
      }
      
      setColumns(columnInfo)
      
      // Try to auto-detect columns based on sample values
      autoDetectColumns(columnInfo, jsonData)
    } catch (err) {
      console.error('Error analyzing file:', err)
      setError('Failed to analyze Excel file structure. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const autoDetectColumns = (columnInfo: ColumnInfo[], jsonData: any[]) => {
    // Try to detect header row and column types
    let bestHeaderRow = 0
    
    // Look for a row that might be headers
    for (let i = 0; i < Math.min(3, jsonData.length); i++) {
      const row = jsonData[i]
      if (Array.isArray(row)) {
        // Check if this row has string values that might be headers
        const stringCount = row.filter(cell => typeof cell === 'string').length
        if (stringCount >= row.length / 2) {
          bestHeaderRow = i
          break
        }
      }
    }
    
    setHeaderRow(bestHeaderRow)
    
    // Try to auto-detect columns based on sample values
    columnInfo.forEach((col, index) => {
      const samples = col.sampleValues.map(s => s.toLowerCase())
      
      // Try to detect item ID column
      if (itemIdColumn === undefined && 
          (samples.some(s => /nr|indeks|id/i.test(s)) || 
           samples.some(s => /^[A-Z0-9]{2,}$/.test(s)))) {
        setItemIdColumn(index)
        return
      }
      
      // Try to detect name column
      if (nameColumn === -1 && 
          (samples.some(s => /nazwa|towar|produkt|item/i.test(s)) || 
           samples.some(s => s.length > 3 && !/^\d+\.?\d*$/.test(s)))) {
        setNameColumn(index)
        return
      }
      
      // Try to detect quantity column
      if (quantityColumn === -1 && 
          (samples.some(s => /ilo|szt|ilość|quantity|amount/i.test(s)) || 
           samples.some(s => /^\d+\.?\d*$/.test(s)))) {
        setQuantityColumn(index)
        return
      }
      
      // Try to detect unit column
      if (unitColumn === -1 && 
          (samples.some(s => /jmz|jednostka|unit|szt|kg|l|ml|g/i.test(s)) || 
           samples.some(s => /^(szt|kg|g|l|ml|cm|m|mm|m2|m3)$/i.test(s)))) {
        setUnitColumn(index)
        return
      }
    })
  }

  const handleApplyMapping = () => {
    if (nameColumn === -1 || quantityColumn === -1 || unitColumn === -1) {
      setError('Please select all required columns (Name, Quantity, and Unit)')
      return
    }
    
    onMappingComplete({
      itemIdColumn: itemIdColumn === -1 ? undefined : itemIdColumn,
      nameColumn,
      quantityColumn,
      unitColumn,
      headerRow
    })
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <p>Analyzing Excel file structure...</p>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Map Excel Columns</CardTitle>
        <CardDescription>
          Select which columns in your Excel file contain the required data.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Column Mapping</AlertTitle>
          <AlertDescription>
            We've analyzed your Excel file. Please verify and adjust the column mappings below.
            Only Name, Quantity, and Unit columns are required - Item ID is optional.
          </AlertDescription>
        </Alert>
        
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Label className="w-32">Header Row</Label>
            <Select 
              value={headerRow.toString()} 
              onValueChange={(value) => setHeaderRow(parseInt(value))}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[...Array(Math.min(5, columns.length > 0 ? 5 : 1))].map((_, i) => (
                  <SelectItem key={i} value={i.toString()}>
                    Row {i + 1}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-4">
            <Label className="w-32">Item ID (Optional)</Label>
            <Select 
              value={itemIdColumn !== undefined ? itemIdColumn.toString() : "-1"}
              onValueChange={(value) => setItemIdColumn(value === "-1" ? undefined : parseInt(value))}
            >
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select column" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="-1">None</SelectItem>
                {columns.map((col) => (
                  <SelectItem key={col.index} value={col.index.toString()}>
                    Column {col.index + 1} {col.sampleValues.length > 0 && `(${col.sampleValues.join(', ')})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-4">
            <Label className="w-32 text-red-500">Name *</Label>
            <Select 
              value={nameColumn.toString()} 
              onValueChange={(value) => setNameColumn(parseInt(value))}
            >
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select column" />
              </SelectTrigger>
              <SelectContent>
                {columns.map((col) => (
                  <SelectItem key={col.index} value={col.index.toString()}>
                    Column {col.index + 1} {col.sampleValues.length > 0 && `(${col.sampleValues.join(', ')})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-4">
            <Label className="w-32 text-red-500">Quantity *</Label>
            <Select 
              value={quantityColumn.toString()} 
              onValueChange={(value) => setQuantityColumn(parseInt(value))}
            >
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select column" />
              </SelectTrigger>
              <SelectContent>
                {columns.map((col) => (
                  <SelectItem key={col.index} value={col.index.toString()}>
                    Column {col.index + 1} {col.sampleValues.length > 0 && `(${col.sampleValues.join(', ')})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-4">
            <Label className="w-32 text-red-500">Unit *</Label>
            <Select 
              value={unitColumn.toString()} 
              onValueChange={(value) => setUnitColumn(parseInt(value))}
            >
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select column" />
              </SelectTrigger>
              <SelectContent>
                {columns.map((col) => (
                  <SelectItem key={col.index} value={col.index.toString()}>
                    Column {col.index + 1} {col.sampleValues.length > 0 && `(${col.sampleValues.join(', ')})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="flex justify-between">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleApplyMapping}>
            Apply Mapping and Process
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}