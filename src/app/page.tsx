'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Upload, FileSpreadsheet, Plus, Edit, Trash2, Download, BarChart } from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import { DataTable } from '@/components/data-table'
import { EditItemDialog } from '@/components/edit-item-dialog'
import { formatQuantityWithConversion } from '@/lib/unit-conversion'
import { toast } from '@/hooks/use-toast'
import Link from 'next/link'

interface ExcelRow {
  id: string
  itemId?: string
  name: string
  quantity: number
  unit: string
}

interface AggregatedItem {
  id: string
  itemId?: string
  name: string
  quantity: number
  unit: string
  fileId?: string
  sourceFiles?: string[]
  count?: number
}

interface UploadedFile {
  id: string
  name: string
  size: number
  uploadDate: string
  rowCount: number
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [excelData, setExcelData] = useState<ExcelRow[]>([])
  const [aggregatedData, setAggregatedData] = useState<AggregatedItem[]>([])
  const [editingItem, setEditingItem] = useState<AggregatedItem | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [isMounted, setIsMounted] = useState(false)
  const [currentView, setCurrentView] = useState<'general' | 'file'>('general')
  const [currentFileName, setCurrentFileName] = useState<string>('')
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [bulkEditMode, setBulkEditMode] = useState(false)
  const [inlineEditingItem, setInlineEditingItem] = useState<string | null>(null)
  const [inlineEditValue, setInlineEditValue] = useState<string>('')
  
  // Manual entry form state
  const [manualEntry, setManualEntry] = useState({
    itemId: '',
    name: '',
    quantity: '',
    unit: ''
  })

  // Handle client-side mounting
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Load initial data only after component is mounted on client
  useEffect(() => {
    if (!isMounted) return
    
    loadData()
    loadUploadedFiles()
  }, [isMounted])


  const loadUploadedFiles = async () => {
    try {
      const response = await fetch('/api/excel/files')
      if (response.ok) {
        const files = await response.json()
        setUploadedFiles(files)
      } else {
        console.error('Failed to load uploaded files:', response.status)
      }
    } catch (error) {
      console.error('Error loading uploaded files:', error)
    }
  }

  const loadData = async () => {
    try {
      console.log('🔄 loadData: Fetching from API...')
      const response = await fetch('/api/excel/data?includeRaw=true')
      if (response.ok) {
        const data = await response.json()
        console.log('📊 loadData: Received data:', {
          aggregatedCount: data.aggregated?.length || 0,
          rawCount: data.raw?.length || 0,
          firstAggregated: data.aggregated?.[0]?.name || 'none'
        })
        setAggregatedData(data.aggregated || [])
        setExcelData(data.raw || [])
        console.log('✅ loadData: State updated')
      } else {
        console.error('Failed to load data:', response.status)
      }
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }

  const onDrop = (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      setFile(file)
      handleFileUpload(file)
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    multiple: false
  })

  const handleFileUpload = async (file: File) => {
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/excel/upload', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const data = await response.json()
        
        // Add to uploaded files list
        const newUploadedFile: UploadedFile = {
          id: data.fileId,
          name: file.name,
          size: file.size,
          uploadDate: new Date().toISOString(),
          rowCount: data.rows?.length || 0
        }
        setUploadedFiles(prev => [newUploadedFile, ...prev])
        
        // Reload all data from API to get the latest aggregated results
        await loadData()
        await loadUploadedFiles()
        
        toast({
          title: "Sukces",
          description: `Plik "${file.name}" został przesłany i przetworzony pomyślnie.`,
        })
      } else {
        const error = await response.json()
        console.error('Upload error:', error)
        toast({
          title: "Error",
          description: error.error || "Failed to upload file",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error uploading file:', error)
      toast({
        title: "Error",
        description: "Failed to upload file",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleEditItem = (item: AggregatedItem) => {
    setEditingItem(item)
    setIsEditDialogOpen(true)
  }

  const handleEditItemById = (id: string) => {
    const item = aggregatedData.find(item => item.id === id)
    if (item) {
      handleEditItem(item)
    }
  }

  const handleSaveEdit = async (updatedItem: AggregatedItem) => {
    try {
      const response = await fetch('/api/excel/data', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: updatedItem.id,
          quantity: updatedItem.quantity
        })
      })

      if (response.ok) {
        setAggregatedData(prev => 
          prev.map(item => item.id === updatedItem.id ? updatedItem : item)
        )
        setIsEditDialogOpen(false)
        setEditingItem(null)
        toast({
          title: "Success",
          description: "Item updated successfully.",
        })
      } else {
        const error = await response.json()
        toast({
          title: "Error",
          description: error.error || "Failed to update item",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error updating item:', error)
      toast({
        title: "Error",
        description: "Failed to update item",
        variant: "destructive",
      })
    }
  }

  const handleDeleteItem = async (id: string) => {
    try {
      const response = await fetch(`/api/excel/data?id=${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setAggregatedData(prev => prev.filter(item => item.id !== id))
        toast({
          title: "Success",
          description: "Item deleted successfully.",
        })
      } else {
        toast({
          title: "Error",
          description: "Failed to delete item",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error deleting item:', error)
      toast({
        title: "Error",
        description: "Failed to delete item",
        variant: "destructive",
      })
    }
  }

  const handleManualEntry = async () => {
    if (!manualEntry.name || !manualEntry.quantity || !manualEntry.unit) {
      toast({
        title: "Error",
        description: "Please fill in name, quantity, and unit",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetch('/api/excel/manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          itemId: manualEntry.itemId || null,
          name: manualEntry.name,
          quantity: parseFloat(manualEntry.quantity),
          unit: manualEntry.unit
        })
      })

      if (response.ok) {
        const newItem = await response.json()
        setAggregatedData(prev => {
          const existingIndex = prev.findIndex(item => 
            item.name === newItem.name && 
            item.unit === newItem.unit && 
            item.itemId === newItem.itemId
          )
          
          if (existingIndex >= 0) {
            const updated = [...prev]
            updated[existingIndex] = newItem
            return updated
          } else {
            return [...prev, newItem]
          }
        })

        // Reset form
        setManualEntry({
          itemId: '',
          name: '',
          quantity: '',
          unit: ''
        })

        toast({
          title: "Success",
          description: "Manual entry added successfully.",
        })
      } else {
        const error = await response.json()
        toast({
          title: "Error",
          description: error.error || "Failed to add manual entry",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error adding manual entry:', error)
      toast({
        title: "Error",
        description: "Failed to add manual entry",
        variant: "destructive",
      })
    }
  }

  const handleExportData = async (type: 'aggregated' | 'raw') => {
    try {
      const response = await fetch(`/api/excel/export?type=${type}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.style.display = 'none'
        a.href = url
        a.download = `${type}_data_${new Date().toISOString().split('T')[0]}.xlsx`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        
        toast({
          title: "Success",
          description: `${type.charAt(0).toUpperCase() + type.slice(1)} data exported successfully.`,
        })
      } else {
        toast({
          title: "Error",
          description: "Failed to export data",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error exporting data:', error)
      toast({
        title: "Error",
        description: "Failed to export data",
        variant: "destructive",
      })
    }
  }

  const handleViewFileData = async (fileId: string) => {
    try {
      const response = await fetch(`/api/excel/data?fileId=${fileId}&includeRaw=true`)
      if (response.ok) {
        const data = await response.json()
        setExcelData(data.raw || [])
        setAggregatedData(data.aggregated || [])
        
        // Find the file name
        const file = uploadedFiles.find(f => f.id === fileId)
        setCurrentFileName(file?.name || 'Nieznany plik')
        setCurrentView('file')
        
        toast({
          title: "Sukces",
          description: "Załadowano dane z wybranego pliku.",
        })
      } else {
        console.error('Failed to load file data:', response.status)
      }
    } catch (error) {
      console.error('Error loading file data:', error)
      toast({
        title: "Błąd",
        description: "Nie udało się załadować danych z pliku",
        variant: "destructive",
      })
    }
  }

  const handleReturnToGeneralView = async () => {
    setCurrentView('general')
    setCurrentFileName('')
    setSelectedItems(new Set())
    setBulkEditMode(false)
    await loadData()
    await loadUploadedFiles()
    toast({
      title: "Powrót",
      description: "Przywrócono widok ogólny ze wszystkimi plikami.",
    })
  }

  const handleToggleBulkEdit = () => {
    setBulkEditMode(!bulkEditMode)
    setSelectedItems(new Set())
  }

  const handleSelectItem = (itemId: string) => {
    const newSelected = new Set(selectedItems)
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId)
    } else {
      newSelected.add(itemId)
    }
    setSelectedItems(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedItems.size === aggregatedData.length) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(aggregatedData.map(item => item.id)))
    }
  }

  const handleBulkDelete = async () => {
    if (selectedItems.size === 0) return
    
    try {
      const promises = Array.from(selectedItems).map(id => 
        fetch(`/api/excel/data?id=${id}`, { method: 'DELETE' })
      )
      
      await Promise.all(promises)
      setAggregatedData(prev => prev.filter(item => !selectedItems.has(item.id)))
      setSelectedItems(new Set())
      setBulkEditMode(false)
      
      toast({
        title: "Sukces",
        description: `Usunięto ${selectedItems.size} pozycji.`,
      })
    } catch (error) {
      console.error('Error during bulk delete:', error)
      toast({
        title: "Błąd",
        description: "Nie udało się usunąć wybranych pozycji",
        variant: "destructive",
      })
    }
  }

  const handleStartInlineEdit = (itemId: string, currentQuantity: number) => {
    setInlineEditingItem(itemId)
    setInlineEditValue(currentQuantity.toString())
  }

  const handleCancelInlineEdit = () => {
    setInlineEditingItem(null)
    setInlineEditValue('')
  }

  const handleSaveInlineEdit = async (itemId: string) => {
    const newQuantity = parseFloat(inlineEditValue)
    if (isNaN(newQuantity) || newQuantity <= 0) {
      toast({
        title: "Błąd",
        description: "Wprowadź prawidłową ilość",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetch('/api/excel/data', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: itemId,
          quantity: newQuantity
        })
      })

      if (response.ok) {
        setAggregatedData(prev => 
          prev.map(item => 
            item.id === itemId 
              ? { ...item, quantity: newQuantity }
              : item
          )
        )
        setInlineEditingItem(null)
        setInlineEditValue('')
        toast({
          title: "Sukces",
          description: "Ilość została zaktualizowana.",
        })
      } else {
        const error = await response.json()
        toast({
          title: "Błąd",
          description: error.error || "Nie udało się zaktualizować ilości",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error updating quantity:', error)
      toast({
        title: "Błąd",
        description: "Nie udało się zaktualizować ilości",
        variant: "destructive",
      })
    }
  }


  const handleDeleteFile = async (fileId: string) => {
    try {
      const response = await fetch(`/api/excel/files?id=${fileId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setUploadedFiles(prev => prev.filter(file => file.id !== fileId))
        // If this was the currently viewed file, clear the data
        if (excelData.length > 0 || aggregatedData.length > 0) {
          setExcelData([])
          setAggregatedData([])
        }
        toast({
          title: "Success",
          description: "File deleted successfully.",
        })
      } else {
        toast({
          title: "Error",
          description: "Failed to delete file",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error deleting file:', error)
      toast({
        title: "Error",
        description: "Failed to delete file",
        variant: "destructive",
      })
    }
  }


  const formatQuantity = (quantity: number, unit: string) => {
    return formatQuantityWithConversion(quantity, unit)
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Manager Inwentury Excel</h1>
          <p className="text-muted-foreground">
            {currentView === 'file' 
              ? `Widok pliku: ${currentFileName}`
              : 'Prześlij pliki Excel, aby zarządzać i agregować dane automatycznie'
            }
          </p>
          <div className="flex justify-center gap-4 text-sm text-muted-foreground">
            <span>Zagregowane: {isMounted ? aggregatedData.length : '...'}</span>
            <span>Surowe: {isMounted ? excelData.length : '...'}</span>
            <span>Pliki: {isMounted ? uploadedFiles.length : '...'}</span>
          </div>
          {currentView === 'file' && (
            <div className="mt-4">
              <Button
                onClick={handleReturnToGeneralView}
                variant="outline"
                className="mx-auto"
              >
                ← Powrót do widoku ogólnego
              </Button>
            </div>
          )}
        </div>

        {/* File Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              Prześlij Plik Excel
            </CardTitle>
            <CardDescription>
              Przeciągnij i upuść plik Excel tutaj lub kliknij, aby przeglądać
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              {isDragActive ? (
                <p>Upuść plik Excel tutaj...</p>
              ) : (
                <div className="space-y-2">
                  <p>Przeciągnij i upuść plik Excel tutaj, lub kliknij aby wybrać</p>
                  <p className="text-sm text-muted-foreground">
                    Obsługuje pliki .xlsx i .xls
                  </p>
                </div>
              )}
            </div>
            {file && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Uploaded Files Preview */}
        {uploadedFiles.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5" />
                Przesłane Pliki ({uploadedFiles.length})
              </CardTitle>
              <CardDescription>
                {currentView === 'general' 
                  ? 'Kliknij na plik, aby wyświetlić jego dane'
                  : 'Lista wszystkich przesłanych plików'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {uploadedFiles.map((uploadedFile) => (
                  <div
                    key={uploadedFile.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
                    onClick={() => handleViewFileData(uploadedFile.id)}
                  >
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="w-8 h-8 text-green-600" />
                      <div>
                        <p className="font-medium text-sm">{uploadedFile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB • {uploadedFile.rowCount} rows • 
                          {new Date(uploadedFile.uploadDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleViewFileData(uploadedFile.id)
                        }}
                      >
                        Podgląd
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteFile(uploadedFile.id)
                        }}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation to Comparison Page */}
        <div className="flex justify-center mb-4 sm:mb-6">
          <Link href="/comparison">
            <Button variant="outline" className="gap-2">
              <BarChart className="w-4 h-4" />
              🔄 Porównanie Miesięczne
            </Button>
          </Link>
        </div>

        <div>
            {/* Data Display Section */}
            {(excelData.length > 0 || aggregatedData.length > 0 || uploadedFiles.length > 0) && (
              <div className="space-y-4">
                {currentView === 'file' && (
                  <Card className="border-primary/50 bg-primary/5">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-semibold">Podgląd pliku: {currentFileName}</h3>
                          <p className="text-sm text-muted-foreground">
                            Wyświetlane są tylko dane z wybranego pliku
                          </p>
                        </div>
                        <Button
                          onClick={handleReturnToGeneralView}
                          variant="outline"
                          className="gap-2"
                        >
                          ← Powrót do podsumowania wszystkich plików
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                <Tabs defaultValue="aggregated" className="space-y-4">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="aggregated">
                      Dane Zagregowane ({aggregatedData.length})
                    </TabsTrigger>
                    <TabsTrigger value="raw">
                      Dane Surowe ({excelData.length})
                    </TabsTrigger>
                  </TabsList>

            <TabsContent value="aggregated">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Dane Zagregowane</CardTitle>
                      <CardDescription>
                        Pozycje o tej samej nazwie i ID zostały automatycznie zsumowane
                        {bulkEditMode && selectedItems.size > 0 && (
                          <span className="ml-2 text-primary">
                            • Wybrano: {selectedItems.size} pozycji
                          </span>
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {aggregatedData.length > 0 && (
                        <Button
                          variant={bulkEditMode ? "default" : "outline"}
                          size="sm"
                          onClick={handleToggleBulkEdit}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          {bulkEditMode ? "Zakończ edycję" : "Edycja masowa"}
                        </Button>
                      )}
                      {bulkEditMode && selectedItems.size > 0 && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleBulkDelete}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Usuń wybrane ({selectedItems.size})
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExportData('aggregated')}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Eksportuj
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {aggregatedData.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">Brak zagregowanych danych. Prześlij plik Excel, aby rozpocząć.</p>
                    </div>
                  ) : (
                    <div className="p-4 bg-muted rounded">
                      <p>DataTable placeholder - {aggregatedData.length} items</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="raw">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Dane Surowe</CardTitle>
                      <CardDescription>
                        Pojedyncze wiersze z Twojego pliku Excel
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExportData('raw')}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Eksportuj
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {excelData.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">Brak surowych danych. Prześlij plik Excel, aby rozpocząć.</p>
                    </div>
                  ) : (
                    <div className="p-4 bg-muted rounded">
                      <p>Raw DataTable placeholder - {excelData.length} items</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

                </Tabs>

                {/* Add Manual Entry */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Plus className="w-5 h-5" />
                      Dodaj Wpis Ręczny
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <Input
                        placeholder="Nr indeksu (opcjonalny)"
                        value={manualEntry.itemId}
                        onChange={(e) => setManualEntry(prev => ({ ...prev, itemId: e.target.value }))}
                      />
                      <Input
                        placeholder="Nazwa towaru"
                        value={manualEntry.name}
                        onChange={(e) => setManualEntry(prev => ({ ...prev, name: e.target.value }))}
                      />
                      <Input
                        placeholder="Ilość"
                        type="number"
                        value={manualEntry.quantity}
                        onChange={(e) => setManualEntry(prev => ({ ...prev, quantity: e.target.value }))}
                      />
                      <Input
                        placeholder="Jednostka (g, kg, l, itd.)"
                        value={manualEntry.unit}
                        onChange={(e) => setManualEntry(prev => ({ ...prev, unit: e.target.value }))}
                      />
                    </div>
                    <Button 
                      className="mt-4 w-full"
                      onClick={handleManualEntry}
                    >
                      Dodaj Wpis
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}
        </div>

        {/* Edit Item Dialog - temporarily disabled */}
        {false && (
          <EditItemDialog
            isOpen={isEditDialogOpen}
            onClose={() => {
              setIsEditDialogOpen(false)
              setEditingItem(null)
            }}
            item={editingItem}
            onSave={handleSaveEdit}
          />
        )}
      </div>
    </div>
  )
}