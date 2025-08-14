'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Upload, FileSpreadsheet, Plus, Edit, Trash2, Download } from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import { DataTable } from '@/components/data-table'
import { EditItemDialog } from '@/components/edit-item-dialog'
import { DataCharts } from '@/components/data-charts'
import { formatQuantityWithConversion } from '@/lib/unit-conversion'
import { toast } from '@/hooks/use-toast'

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
  
  // Manual entry form state
  const [manualEntry, setManualEntry] = useState({
    itemId: '',
    name: '',
    quantity: '',
    unit: ''
  })

  // Load initial data
  console.log('About to define useEffect')
  useEffect(() => {
    console.log('Component mounted/updated, loading initial data...')
    try {
      loadData()
      loadUploadedFiles()
    } catch (error) {
      console.error('Error in useEffect:', error)
    }
  }) // Remove dependency array to run on every render
  console.log('useEffect defined')

  const loadUploadedFiles = async () => {
    try {
      console.log('Loading uploaded files...')
      const response = await fetch('/api/excel/files')
      console.log('Files response status:', response.status)
      if (response.ok) {
        const files = await response.json()
        console.log('Loaded files:', files)
        console.log('Files length:', files?.length)
        setUploadedFiles(files)
      } else {
        console.error('Failed to load uploaded files:', response.status)
        const errorText = await response.text()
        console.error('Error response:', errorText)
      }
    } catch (error) {
      console.error('Error loading uploaded files:', error)
    }
  }

  const loadData = async () => {
    try {
      console.log('Loading data...')
      const response = await fetch('/api/excel/data?includeRaw=true')
      console.log('Data response status:', response.status)
      if (response.ok) {
        const data = await response.json()
        console.log('Loaded data:', data)
        console.log('Aggregated data length:', data.aggregated?.length)
        console.log('Raw data length:', data.raw?.length)
        setAggregatedData(data.aggregated || [])
        setExcelData(data.raw || [])
      } else {
        console.error('Failed to load data:', response.status)
        const errorText = await response.text()
        console.error('Error response:', errorText)
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
        console.log('Upload response:', data)
        setExcelData(data.rows || [])
        setAggregatedData(data.aggregated || [])
        
        // Add to uploaded files list
        const newUploadedFile: UploadedFile = {
          id: data.fileId,
          name: file.name,
          size: file.size,
          uploadDate: new Date().toISOString(),
          rowCount: data.rows?.length || 0
        }
        setUploadedFiles(prev => [newUploadedFile, ...prev])
        
        toast({
          title: "Success",
          description: `File "${file.name}" uploaded and processed successfully.`,
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
        console.log('File data loaded:', data)
        setExcelData(data.raw || [])
        setAggregatedData(data.aggregated || [])
        toast({
          title: "Success",
          description: "Loaded data from selected file.",
        })
      } else {
        console.error('Failed to load file data:', response.status)
      }
    } catch (error) {
      console.error('Error loading file data:', error)
      toast({
        title: "Error",
        description: "Failed to load file data",
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

  // Add state logging to debug data issues
  useEffect(() => {
    console.log('Current state:', {
      excelData: excelData,
      aggregatedData: aggregatedData,
      uploadedFiles: uploadedFiles
    })
  }, [excelData, aggregatedData, uploadedFiles])

  const formatQuantity = (quantity: number, unit: string) => {
    return formatQuantityWithConversion(quantity, unit)
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Excel Data Manager</h1>
          <p className="text-muted-foreground">
            Upload Excel files to manage and aggregate your data automatically
          </p>
          <div className="flex justify-center gap-4 text-sm">
            <span>Aggregated: {aggregatedData.length}</span>
            <span>Raw: {excelData.length}</span>
            <span>Files: {uploadedFiles.length}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            Debug: Component rendered at {new Date().toLocaleTimeString()}
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              console.log('Refresh button clicked')
              loadData()
              loadUploadedFiles()
            }}
          >
            Refresh Data
          </Button>
        </div>

        {/* File Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              Upload Excel File
            </CardTitle>
            <CardDescription>
              Drag and drop your Excel file here or click to browse
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
                <p>Drop the Excel file here...</p>
              ) : (
                <div className="space-y-2">
                  <p>Drag and drop an Excel file here, or click to select</p>
                  <p className="text-sm text-muted-foreground">
                    Supports .xlsx and .xls files
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
                Uploaded Files ({uploadedFiles.length})
              </CardTitle>
              <CardDescription>
                Click on a file to view its data
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
                        View
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

        {/* Data Display Section */}
        {(excelData.length > 0 || aggregatedData.length > 0 || uploadedFiles.length > 0) && (
          <Tabs defaultValue="aggregated" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="aggregated">
                Aggregated Data ({aggregatedData.length})
              </TabsTrigger>
              <TabsTrigger value="raw">
                Raw Data ({excelData.length})
              </TabsTrigger>
              <TabsTrigger value="charts">
                Charts ({aggregatedData.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="aggregated">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Aggregated Data</CardTitle>
                      <CardDescription>
                        Items with the same name and ID have been automatically summed
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExportData('aggregated')}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {aggregatedData.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">No aggregated data available. Upload an Excel file to get started.</p>
                    </div>
                  ) : (
                    <DataTable
                      data={aggregatedData}
                      onEdit={handleEditItemById}
                      onDelete={handleDeleteItem}
                      showAggregated={true}
                      uploadedFiles={uploadedFiles}
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="raw">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Raw Data</CardTitle>
                      <CardDescription>
                        Individual rows from your Excel file
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExportData('raw')}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {excelData.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">No raw data available. Upload an Excel file to get started.</p>
                    </div>
                  ) : (
                    <DataTable
                      data={excelData}
                      onEdit={handleEditItemById}
                      onDelete={handleDeleteItem}
                      showAggregated={false}
                      uploadedFiles={uploadedFiles}
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="charts">
              <DataCharts data={aggregatedData} />
            </TabsContent>
          </Tabs>
        )}

        {/* Add Manual Entry */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Add Manual Entry
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Input
                placeholder="Item ID (optional)"
                value={manualEntry.itemId}
                onChange={(e) => setManualEntry(prev => ({ ...prev, itemId: e.target.value }))}
              />
              <Input
                placeholder="Item name"
                value={manualEntry.name}
                onChange={(e) => setManualEntry(prev => ({ ...prev, name: e.target.value }))}
              />
              <Input
                placeholder="Quantity"
                type="number"
                value={manualEntry.quantity}
                onChange={(e) => setManualEntry(prev => ({ ...prev, quantity: e.target.value }))}
              />
              <Input
                placeholder="Unit (g, kg, etc.)"
                value={manualEntry.unit}
                onChange={(e) => setManualEntry(prev => ({ ...prev, unit: e.target.value }))}
              />
            </div>
            <Button 
              className="mt-4 w-full"
              onClick={handleManualEntry}
            >
              Add Entry
            </Button>
          </CardContent>
        </Card>

        {/* Edit Item Dialog */}
        <EditItemDialog
          isOpen={isEditDialogOpen}
          onClose={() => {
            setIsEditDialogOpen(false)
            setEditingItem(null)
          }}
          item={editingItem}
          onSave={handleSaveEdit}
        />
      </div>
    </div>
  )
}