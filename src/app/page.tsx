'use client'

import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
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
import { Upload, FileSpreadsheet, Plus, Edit, Trash2, Download, BarChart, X } from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import { DataTable } from '@/components/data-table'

// Lazy load heavy components
const EditItemDialog = lazy(() => import('@/components/edit-item-dialog').then(m => ({ default: m.EditItemDialog })))
const ColumnMappingComponent = lazy(() => import('@/components/column-mapping').then(m => ({ default: m.ColumnMapping })))
import { formatQuantityWithConversion } from '@/lib/unit-conversion'
import { getFileColorClass, getFileBorderColor, getFileBackgroundColor, getFileInlineStyle, getFileInlineStyleWithShadow } from '@/lib/colors'
import { validateFile, validateExcelStructure, getValidationSummary } from '@/lib/file-validation'
import { useUploadProgress } from '@/hooks/use-upload-progress'
import { UploadProgressComponent } from '@/components/upload-progress'
import { usePagination } from '@/hooks/use-pagination'
import { toast } from '@/hooks/use-toast'
import { 
  handleApiResponse, 
  handleAsyncOperation, 
  showErrorToast, 
  showSuccessToast,
  createError,
  ErrorType
} from '@/lib/error-handler'
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
  category?: string
  fileId?: string
  sourceFiles?: string[]
  count?: number
  isAggregated?: boolean // Flag to indicate if item is aggregated
  isDuplicate?: boolean
  duplicateCount?: number
  originalIndex?: number
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
  const { uploadProgress, uploadWithProgress, resetProgress } = useUploadProgress()
  const pagination = usePagination({
    initialLimit: 25, // Smaller limit for better UX
    initialSortBy: 'name'
  })
  
  // Separate pagination hook for file view
  const filePagination = usePagination({
    initialPage: 1,
    initialLimit: 50, // Larger limit for file view
    initialSortBy: 'name'
  })
  
  // Pagination hook for raw data in general view
  const rawDataPagination = usePagination({
    initialPage: 1,
    initialLimit: 50, // Larger limit for raw data
    initialSortBy: 'name'
  })
  const [excelData, setExcelData] = useState<ExcelRow[]>([])
  const [aggregatedData, setAggregatedData] = useState<AggregatedItem[]>([])
  const [editingItem, setEditingItem] = useState<AggregatedItem | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [isMounted, setIsMounted] = useState(false)
  const [currentView, setCurrentView] = useState<'general' | 'file'>('general')
  const [currentFileName, setCurrentFileName] = useState<string>('')
  const [currentFileId, setCurrentFileId] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'aggregated' | 'raw'>('aggregated')
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [bulkEditMode, setBulkEditMode] = useState(false)
  const [inlineEditingItem, setInlineEditingItem] = useState<string | null>(null)
  const [inlineEditValue, setInlineEditValue] = useState<string>('')
  
  // Column mapping state
  const [showColumnMapping, setShowColumnMapping] = useState(false)
  const [columnMapping, setColumnMapping] = useState<{ 
    itemIdColumn?: number, 
    nameColumn: number, 
    quantityColumn: number, 
    unitColumn: number,
    headerRow: number
  } | null>(null)
  
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

  const loadUploadedFiles = useCallback(async () => {
    const result = await handleAsyncOperation(async () => {
      const response = await fetch('/api/excel/files')
      return await handleApiResponse<any>(response)
    }, 'Nie udało się załadować przesłanych plików')
    
    if (result) {
      setUploadedFiles(result)
    }
  }, [])

  const loadData = useCallback(async (useCurrentFilters = true) => {
    const result = await handleAsyncOperation(async () => {
      pagination.setIsLoading(true)
      
      // Build URL with pagination parameters (only for general view)
      const url = new URL('/api/excel/data', window.location.origin)
      url.searchParams.set('includeRaw', 'true')
      
      if (currentView === 'general' && useCurrentFilters) {
        // Add pagination parameters for general view
        pagination.queryParams.forEach((value, key) => {
          url.searchParams.set(key, value)
        })
      }
      
      const response = await fetch(url.toString())
      const data = await handleApiResponse<any>(response)
      
      
      // Update pagination metadata if available
      if (data.pagination && currentView === 'general' && useCurrentFilters) {
        pagination.setPaginationMeta(data.pagination)
      }
      
      // Add isAggregated flag to aggregated data
      const aggregatedWithFlags = (data.aggregated || []).map((item: any) => ({
        ...item,
        isAggregated: (item.sourceFiles && item.sourceFiles.length > 1) || 
                     (item.count && item.count > 1) ||
                     (item.sourceFiles && item.sourceFiles.length > 0 && 
                      !item.fileId) // If it has sourceFiles but no direct fileId, it's aggregated
      }))
      
      setAggregatedData(aggregatedWithFlags)
      setExcelData(data.raw || [])
      
      return data
    }, 'Nie udało się załadować danych')

    pagination.setIsLoading(false)
    return result
  }, [currentView, pagination.setIsLoading, pagination.setPaginationMeta, pagination.queryParams])

  // Load file data with pagination
  const loadFileData = useCallback(async (fileId: string) => {
    const result = await handleAsyncOperation(async () => {
      filePagination.setIsLoading(true)
      
      // Build URL with pagination parameters for file view
      const url = new URL('/api/excel/data', window.location.origin)
      url.searchParams.set('fileId', fileId)
      url.searchParams.set('includeRaw', 'true')
      
      // Add pagination parameters for file view
      filePagination.queryParams.forEach((value, key) => {
        url.searchParams.set(key, value)
      })
      
      const response = await fetch(url.toString())
      const data = await handleApiResponse<any>(response)
      
      // Update pagination metadata if available
      if (data.pagination) {
        filePagination.setPaginationMeta(data.pagination)
      }
      
      // For file view, show only the raw data from this specific file
      setExcelData(data.raw || [])
      setAggregatedData([]) // Clear aggregated data to avoid confusion
      
      return data
    }, 'Nie udało się załadować danych pliku')

    filePagination.setIsLoading(false)
    return result
  }, [filePagination.setIsLoading, filePagination.setPaginationMeta, filePagination.queryParams])

  // Load raw data with pagination for general view
  const loadRawData = useCallback(async () => {
    const result = await handleAsyncOperation(async () => {
      rawDataPagination.setIsLoading(true)
      
      // Build URL with pagination parameters for raw data view
      const url = new URL('/api/excel/data', window.location.origin)
      url.searchParams.set('includeRaw', 'true')
      url.searchParams.set('rawOnly', 'true') // New parameter to get only raw data
      
      // Add pagination parameters for raw data view
      rawDataPagination.queryParams.forEach((value, key) => {
        url.searchParams.set(key, value)
      })
      
      const response = await fetch(url.toString())
      const data = await handleApiResponse<any>(response)
      
      // Update pagination metadata if available
      if (data.pagination) {
        rawDataPagination.setPaginationMeta(data.pagination)
      }
      
      // For raw data view, show only the raw data
      setExcelData(data.raw || [])
      
      return data
    }, 'Nie udało się załadować surowych danych')

    rawDataPagination.setIsLoading(false)
    return result
  }, [rawDataPagination.setIsLoading, rawDataPagination.setPaginationMeta, rawDataPagination.queryParams])

  // Load initial data only after component is mounted on client
  useEffect(() => {
    if (!isMounted) return
    
    loadData()
    loadUploadedFiles()
    
    // Also load raw data if raw tab is active
    if (activeTab === 'raw' && currentView === 'general') {
      loadRawData()
    }
  }, [isMounted, loadData, loadUploadedFiles, loadRawData, activeTab, currentView])

  // Reload data when pagination state changes (only for general view)
  useEffect(() => {
    if (!isMounted || currentView !== 'general') return
    
    loadData(true)
  }, [
    pagination.paginationState.page,
    pagination.paginationState.limit,
    pagination.paginationState.search,
    pagination.paginationState.sortBy,
    pagination.paginationState.sortDirection,
    isMounted,
    currentView,
    loadData
  ])

  // Reload file data when file pagination state changes
  useEffect(() => {
    if (!isMounted || currentView !== 'file' || !currentFileId) return
    
    loadFileData(currentFileId)
  }, [
    filePagination.paginationState.page,
    filePagination.paginationState.limit,
    filePagination.paginationState.search,
    filePagination.paginationState.sortBy,
    filePagination.paginationState.sortDirection,
    isMounted,
    currentView,
    currentFileId,
    loadFileData
  ])

  // Reload raw data when raw data pagination state changes (general view + raw tab only)
  useEffect(() => {
    if (!isMounted || currentView !== 'general' || activeTab !== 'raw') return
    
    loadRawData()
  }, [
    rawDataPagination.paginationState.page,
    rawDataPagination.paginationState.limit,
    rawDataPagination.paginationState.search,
    rawDataPagination.paginationState.sortBy,
    rawDataPagination.paginationState.sortDirection,
    isMounted,
    currentView,
    activeTab,
    loadRawData
  ])

  const onDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    
    if (!file) return

    // Validate file
    const basicValidation = validateFile(file)
    if (!basicValidation.isValid) {
      showErrorToast(createError(ErrorType.VALIDATION, basicValidation.error))
      return
    }

    // Show warnings if any
    if (basicValidation.warnings && basicValidation.warnings.length > 0) {
      toast({
        title: "Ostrzeżenia dotyczące pliku",
        description: basicValidation.warnings.join('\n'),
        variant: "default",
      })
    }

    // Validate Excel structure
    const structureValidation = await validateExcelStructure(file)
    if (!structureValidation.isValid) {
      showErrorToast(createError(ErrorType.FILE_PROCESSING, structureValidation.error))
      return
    }

    // File is valid
    setFile(file)
    showSuccessToast(getValidationSummary(basicValidation, file), "Plik zaakceptowany")
    
    // For better Excel compatibility, show column mapping interface
    setShowColumnMapping(true)
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    multiple: false
  })

  const handleFileUpload = async (file: File, mapping: { 
    itemIdColumn?: number, 
    nameColumn: number, 
    quantityColumn: number, 
    unitColumn: number,
    headerRow: number
  } | null = null) => {
    setIsUploading(true)
    resetProgress()
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      // Use standard upload endpoint
      const endpoint = '/api/excel/upload'
      
      if (mapping) {
        formData.append('columnMapping', JSON.stringify(mapping))
      }

      await uploadWithProgress(endpoint, formData, async (data) => {
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
        
        showSuccessToast(`Plik "${file.name}" został przesłany i przetworzony pomyślnie.`)
      })
    } catch (error) {
      // Error is already handled by uploadWithProgress hook
      console.error('Error uploading file:', error)
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
    const result = await handleAsyncOperation(async () => {
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

      await handleApiResponse<any>(response)

      setAggregatedData(prev => 
        prev.map(item => item.id === updatedItem.id ? updatedItem : item)
      )
      setIsEditDialogOpen(false)
      setEditingItem(null)
      
      showSuccessToast("Pozycja została zaktualizowana pomyślnie.")
      return true
    }, 'Nie udało się zaktualizować pozycji')

    return result
  }

  const handleDeleteItem = async (id: string) => {
    const result = await handleAsyncOperation(async () => {
      const response = await fetch(`/api/excel/data?id=${id}`, {
        method: 'DELETE'
      })

      await handleApiResponse<any>(response)

      setAggregatedData(prev => prev.filter(item => item.id !== id))
      showSuccessToast("Pozycja została usunięta pomyślnie.")
      return true
    }, 'Nie udało się usunąć pozycji')

    return result
  }

  const handleColumnMappingComplete = (mapping: { 
    itemIdColumn?: number, 
    nameColumn: number, 
    quantityColumn: number, 
    unitColumn: number,
    headerRow: number
  }) => {
    setColumnMapping(mapping)
    setShowColumnMapping(false)
    if (file) {
      handleFileUpload(file, mapping)
    }
  }

  const handleCancelColumnMapping = () => {
    setShowColumnMapping(false)
    setFile(null)
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
    const result = await handleAsyncOperation(async () => {
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
        
        showSuccessToast(`${type.charAt(0).toUpperCase() + type.slice(1)} dane wyeksportowane pomyślnie.`, 'Sukces')
        return true
      } else {
        const error = await parseHttpError(response)
        showErrorToast(error)
        throw error
      }
    }, 'Nie udało się wyeksportować danych')
  }

  const handleViewFileData = async (fileId: string) => {
    // Find the file name
    const file = uploadedFiles.find(f => f.id === fileId)
    setCurrentFileName(file?.name || 'Nieznany plik')
    setCurrentFileId(fileId)
    setCurrentView('file')
    
    // Reset file pagination to first page
    filePagination.reset()
    
    // Load file data with pagination
    const result = await loadFileData(fileId)
    
    if (result) {
      toast({
        title: "Sukces",
        description: `Wyświetlanie danych z pliku: ${file?.name || 'Nieznany plik'}`
      })
    }
  }

  const handleReturnToGeneralView = async () => {
    setCurrentView('general')
    setCurrentFileName('')
    setCurrentFileId('')
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
    
    const result = await handleAsyncOperation(async () => {
      const promises = Array.from(selectedItems).map(async id => {
        const response = await fetch(`/api/excel/data?id=${id}`, { method: 'DELETE' })
        return handleApiResponse(response)
      })
      
      await Promise.all(promises)
      setAggregatedData(prev => prev.filter(item => !selectedItems.has(item.id)))
      setSelectedItems(new Set())
      setBulkEditMode(false)
      
      showSuccessToast(`Usunięto ${selectedItems.size} pozycji.`, 'Sukces')
      return true
    }, 'Nie udało się usunąć wybranych pozycji')
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
    if (!inlineEditValue) return
    
    const newQuantity = parseFloat(inlineEditValue)
    if (isNaN(newQuantity)) {
      toast({
        title: "Błąd",
        description: "Podaj poprawną liczbę",
        variant: "destructive",
      })
      return
    }

    const result = await handleAsyncOperation(async () => {
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
        showSuccessToast('Ilość została zaktualizowana.', 'Sukces')
        return true
      } else {
        const error = await parseHttpError(response)
        showErrorToast(error)
        throw error
      }
    }, 'Nie udało się zaktualizować ilości')
  }


  const handleDeleteFile = async (fileId: string) => {
    const result = await handleAsyncOperation(async () => {
      const response = await fetch(`/api/excel/files?id=${fileId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setUploadedFiles(prev => prev.filter(file => file.id !== fileId))
        // Reload all data to get the updated aggregation from remaining files
        await loadData()
        await loadUploadedFiles()
        showSuccessToast('Plik usunięty pomyślnie.', 'Sukces')
        return true
      } else {
        const error = await parseHttpError(response)
        showErrorToast(error)
        throw error
      }
    }, 'Nie udało się usunąć pliku')
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
        </div>

        {/* Column Mapping Dialog */}
        {showColumnMapping && file && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-4xl">
              <div className="flex justify-end mb-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleCancelColumnMapping}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <Suspense fallback={
                <div className="flex items-center justify-center p-8">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                    <p className="text-sm text-muted-foreground">Ładowanie mapowania kolumn...</p>
                  </div>
                </div>
              }>
                <ColumnMappingComponent 
                  file={file} 
                  onMappingComplete={handleColumnMappingComplete}
                  onCancel={handleCancelColumnMapping}
                />
              </Suspense>
            </div>
          </div>
        )}

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
            {file && !showColumnMapping && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upload Progress */}
        {(uploadProgress.status !== 'idle' || isUploading) && (
          <UploadProgressComponent
            progress={uploadProgress}
            fileName={file?.name}
            onClose={() => {
              resetProgress()
              setFile(null)
            }}
          />
        )}

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
                    className={`flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group ${(uploadedFile.id && typeof uploadedFile.id === 'string') ? getFileBorderColor(uploadedFile.id) : ''}`}
                    onClick={() => handleViewFileData(uploadedFile.id)}
                  >
                    <div className="flex items-center gap-3">
                      {(uploadedFile.id && typeof uploadedFile.id === 'string') && (
                        <div 
                          className="w-5 h-5 rounded-full border-2"
                          style={{
                            ...getFileInlineStyleWithShadow(uploadedFile.id),
                            borderColor: '#ffffff'
                          }}
                        ></div>
                      )}
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
              Porównanie Miesięczne
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
                          variant="default"
                          size="lg"
                          className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg"
                        >
                          ← Powrót do podsumowania wszystkich plików
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                <Tabs 
                  defaultValue={currentView === 'file' ? 'raw' : 'aggregated'} 
                  value={currentView === 'file' ? 'raw' : activeTab}
                  onValueChange={(value) => setActiveTab(value as 'aggregated' | 'raw')}
                  className="space-y-4"
                >
                  <TabsList className={`grid w-full ${currentView === 'file' ? 'grid-cols-1' : 'grid-cols-2'}`}>
                    {currentView !== 'file' && (
                      <TabsTrigger value="aggregated">
                        Dane Zagregowane ({aggregatedData.length})
                      </TabsTrigger>
                    )}
                    <TabsTrigger value="raw">
                      {currentView === 'file' ? `Dane z pliku (${excelData.length})` : `Dane Surowe (${excelData.length})`}
                    </TabsTrigger>
                  </TabsList>

            {currentView !== 'file' && (
              <TabsContent value="aggregated">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Dane Zagregowane</CardTitle>
                        <CardDescription>
                          Pozycje o tej samej nazwie i ID zostały automatycznie zsumowane
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        {aggregatedData.length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleExportData('aggregated')}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Eksportuj
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {aggregatedData.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground">Brak zagregowanych danych. Prześlij plik Excel, aby rozpocząć.</p>
                      </div>
                    ) : (
                      <DataTable
                        data={aggregatedData}
                        onEdit={handleEditItemById}
                        onDelete={handleDeleteItem}
                        inlineEditingItem={inlineEditingItem}
                        inlineEditValue={inlineEditValue}
                        onInlineEditValueChange={(value) => setInlineEditValue(value)}
                        showAggregated={true}
                        uploadedFiles={uploadedFiles}
                        onStartInlineEdit={handleStartInlineEdit}
                        onCancelInlineEdit={handleCancelInlineEdit}
                        onSaveInlineEdit={handleSaveInlineEdit}
                        // Pagination props (only for general view)
                        paginationState={currentView === 'general' ? pagination.paginationState : undefined}
                        paginationMeta={currentView === 'general' ? pagination.paginationMeta || undefined : undefined}
                        onPaginationChange={currentView === 'general' ? {
                          setPage: pagination.setPage,
                          setLimit: pagination.setLimit,
                          setSearch: pagination.setSearch,
                          setSorting: pagination.setSorting
                        } : undefined}
                        isLoading={currentView === 'general' ? pagination.isLoading : false}
                      />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}

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
                    <DataTable
                      data={excelData}
                      onEdit={handleEditItemById}
                      onDelete={handleDeleteItem}
                      uploadedFiles={uploadedFiles}
                      onStartInlineEdit={handleStartInlineEdit}
                      onCancelInlineEdit={handleCancelInlineEdit}
                      onSaveInlineEdit={handleSaveInlineEdit}
                      onInlineEditValueChange={(value) => setInlineEditValue(value)}
                      inlineEditingItem={inlineEditingItem}
                      inlineEditValue={inlineEditValue}
                      // Pagination props for raw data (file view or general view)
                      paginationState={currentView === 'file' ? filePagination.paginationState : rawDataPagination.paginationState}
                      paginationMeta={currentView === 'file' ? filePagination.paginationMeta || undefined : rawDataPagination.paginationMeta || undefined}
                      onPaginationChange={currentView === 'file' ? {
                        setPage: filePagination.setPage,
                        setLimit: filePagination.setLimit,
                        setSearch: filePagination.setSearch,
                        setSorting: filePagination.setSorting
                      } : {
                        setPage: rawDataPagination.setPage,
                        setLimit: rawDataPagination.setLimit,
                        setSearch: rawDataPagination.setSearch,
                        setSorting: rawDataPagination.setSorting
                      }}
                      isLoading={currentView === 'file' ? filePagination.isLoading : rawDataPagination.isLoading}
                    />
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

        {/* Edit Item Dialog */}
        <Suspense fallback={null}>
          <EditItemDialog
            isOpen={isEditDialogOpen}
            onClose={() => {
              setIsEditDialogOpen(false)
              setEditingItem(null)
            }}
            item={editingItem}
            onSave={handleSaveEdit}
          />
        </Suspense>
      </div>
    </div>
  )
}