'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { BarChart, ArrowLeft, FileSpreadsheet, Check, Plus } from 'lucide-react'
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

interface ComparisonDiff {
  type: string
  name: any
  itemId: any
  unit: any
  quantity1: number
  quantity2: number
  difference: number
  percentChange: number | null
}

interface ComparisonAlert {
  level: string
  type: string
  message: string
  item: any
}

export default function ComparisonPage() {
  const [aggregatedData, setAggregatedData] = useState<AggregatedItem[]>([])
  const [previousMonthFile, setPreviousMonthFile] = useState<File | null>(null)
  const [previousMonthData, setPreviousMonthData] = useState<any[]>([])
  const [useCurrentAggregation, setUseCurrentAggregation] = useState<boolean>(true)
  const [comparisonData, setComparisonData] = useState<ComparisonDiff[] | null>(null)
  const [comparisonAlerts, setComparisonAlerts] = useState<ComparisonAlert[]>([])
  const [isMounted, setIsMounted] = useState(false)

  // Handle client-side mounting
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Load initial data only after component is mounted on client
  useEffect(() => {
    if (!isMounted) return
    loadData()
  }, [isMounted])

  const loadData = async () => {
    const result = await handleAsyncOperation(async () => {
      console.log('loadData: Fetching from API...')
      const response = await fetch('/api/excel/data?includeRaw=true')
      const data = await handleApiResponse<any>(response)
      
      console.log('loadData: Received data:', {
        aggregatedCount: data.aggregated?.length || 0,
        firstAggregated: data.aggregated?.[0]?.name || 'none'
      })
      
      setAggregatedData(data.aggregated || [])
      console.log('✅ loadData: State updated')
      
      return data
    }, 'Nie udało się załadować danych')
  }

  const processPreviousMonthFile = async (file: File): Promise<any[]> => {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch('/api/excel/upload', {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      throw new Error('Failed to process previous month file')
    }

    const data = await response.json()
    return data.aggregated || []
  }

  const handleMonthlyComparison = async () => {
    if (!previousMonthFile) {
      toast({
        title: "Błąd",
        description: "Prześlij plik poprzedniego miesiąca",
        variant: "destructive"
      })
      return
    }

    if (!useCurrentAggregation && aggregatedData.length === 0) {
      toast({
        title: "Błąd", 
        description: "Brak danych bieżących do porównania",
        variant: "destructive"
      })
      return
    }

    try {
      // Process previous month file
      const previousData = await processPreviousMonthFile(previousMonthFile)
      
      // Use current aggregation or upload new file
      const currentData = useCurrentAggregation ? aggregatedData : []
      
      // Compare: previous month vs current month
      const differences = analyzeInventoryDifferences(previousData, currentData)
      const alerts = generateInventoryAlerts(differences)

      setComparisonData(differences)
      setComparisonAlerts(alerts)
      setPreviousMonthData(previousData)

      toast({
        title: "Porównanie miesięczne zakończone",
        description: `Porównano ${previousData.length} pozycji z poprzedniego miesiąca z ${currentData.length} bieżącymi. Znaleziono ${differences.length} różnic.`,
      })
    } catch (error) {
      console.error('Monthly comparison error:', error)
      toast({
        title: "Błąd",
        description: "Nie udało się przeprowadzić porównania miesięcznego",
        variant: "destructive"
      })
    }
  }

  const analyzeInventoryDifferences = (inventory1: any[], inventory2: any[]) => {
    const items1 = new Map(inventory1.map(item => [`${item.itemId}_${item.name}_${item.unit}`, item]))
    const items2 = new Map(inventory2.map(item => [`${item.itemId}_${item.name}_${item.unit}`, item]))
    
    const differences: ComparisonDiff[] = []
    const allKeys = new Set([...items1.keys(), ...items2.keys()])
    
    allKeys.forEach(key => {
      const item1 = items1.get(key)
      const item2 = items2.get(key)
      
      if (!item1 && item2) {
        // Nowy produkt
        differences.push({
          type: 'new',
          name: item2.name,
          itemId: item2.itemId,
          unit: item2.unit,
          quantity1: 0,
          quantity2: item2.quantity,
          difference: item2.quantity,
          percentChange: null
        })
      } else if (item1 && !item2) {
        // Produkt zniknął
        differences.push({
          type: 'missing',
          name: item1.name,
          itemId: item1.itemId,
          unit: item1.unit,
          quantity1: item1.quantity,
          quantity2: 0,
          difference: -item1.quantity,
          percentChange: -100
        })
      } else if (item1 && item2) {
        // Produkt istnieje w obu - sprawdź różnice
        const diff = item2.quantity - item1.quantity
        const percentChange = item1.quantity > 0 ? (diff / item1.quantity) * 100 : 0
        
        if (Math.abs(diff) > 0.01) { // Tolerancja dla małych różnic
          differences.push({
            type: diff > 0 ? 'increase' : 'decrease',
            name: item1.name,
            itemId: item1.itemId,
            unit: item1.unit,
            quantity1: item1.quantity,
            quantity2: item2.quantity,
            difference: diff,
            percentChange: percentChange
          })
        }
      }
    })
    
    return differences.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference))
  }

  const generateInventoryAlerts = (differences: ComparisonDiff[]) => {
    const alerts: ComparisonAlert[] = []
    
    differences.forEach(diff => {
      if (diff.type === 'missing') {
        alerts.push({
          level: 'critical',
          type: 'missing_item',
          message: `BRAK PRODUKTU: ${diff.name} (${diff.quantity1} ${diff.unit}) - produkt całkowicie zniknął z inwentarza!`,
          item: diff
        })
      } else if (diff.type === 'decrease' && Math.abs(diff.difference) >= 10) {
        const severity = Math.abs(diff.difference) >= 50 ? 'critical' : 'warning'
        alerts.push({
          level: severity,
          type: 'significant_decrease',
          message: `ZNACZNY SPADEK: ${diff.name} - spadek o ${Math.abs(diff.difference).toFixed(1)} ${diff.unit} (${diff.percentChange?.toFixed(1)}%)`,
          item: diff
        })
      } else if (diff.type === 'increase' && diff.difference >= 20) {
        alerts.push({
          level: 'info',
          type: 'significant_increase',
          message: `WZROST: ${diff.name} - wzrost o ${diff.difference.toFixed(1)} ${diff.unit} (${diff.percentChange?.toFixed(1)}%)`,
          item: diff
        })
      } else if (diff.type === 'new') {
        alerts.push({
          level: 'info',
          type: 'new_item',
          message: `NOWY PRODUKT: ${diff.name} (${diff.quantity2} ${diff.unit})`,
          item: diff
        })
      }
    })
    
    return alerts.sort((a, b) => {
      const levelOrder: Record<string, number> = { critical: 3, warning: 2, info: 1 }
      return levelOrder[b.level] - levelOrder[a.level]
    })
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-4 mb-4">
            <Link href="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Powrót do zarządzania inwentarzem
              </Button>
            </Link>
          </div>
          <h1 className="text-3xl font-bold">Porównanie Miesięczne Inwentarza</h1>
          <p className="text-muted-foreground">
            Porównaj bieżący inwentarz z poprzednim miesiącem i otrzymaj inteligentne analizy zmian
          </p>
          <div className="flex justify-center gap-4 text-sm text-muted-foreground">
            <span>Bieżące pozycje: {isMounted ? aggregatedData.length : '...'}</span>
            <span>Poprzedni miesiąc: {previousMonthData.length}</span>
            <span>Różnice: {comparisonData?.length || 0}</span>
          </div>
        </div>

        {/* Main Comparison Card */}
        <Card>
          <CardHeader>
            <CardTitle>Porównanie Miesięczne Inwentarza</CardTitle>
            <CardDescription>
              Porównaj bieżący inwentarz z poprzednim miesiącem i otrzymaj inteligentne analizy zmian
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* File Selection Method */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Wybierz dane do porównania</h3>
                
                {/* Current Month Selection */}
                <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm sm:text-base">Dane Bieżące (Obecny miesiąc)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        <div className="w-full">
                          <Button
                            variant={useCurrentAggregation ? "default" : "outline"}
                            size="sm"
                            onClick={() => setUseCurrentAggregation(true)}
                            className="w-full justify-start text-xs sm:text-sm h-auto py-3"
                          >
                            <div className="text-left">
                              <div>Użyj bieżącej agregacji</div>
                              <div className="text-xs opacity-75">({aggregatedData.length} pozycji)</div>
                            </div>
                          </Button>
                        </div>
                        <div className="w-full">
                          <Button
                            variant={!useCurrentAggregation ? "default" : "outline"}
                            size="sm"
                            onClick={() => setUseCurrentAggregation(false)}
                            className="w-full justify-start text-xs sm:text-sm h-auto py-3"
                          >
                            Prześlij nowy plik
                          </Button>
                        </div>
                        
                        {!useCurrentAggregation && (
                          <div className="mt-3">
                            <input
                              type="file"
                              accept=".xlsx,.xls"
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                // Handle current month file upload
                              }}
                              className="block w-full text-xs sm:text-sm text-gray-500 file:mr-2 sm:file:mr-4 file:py-2 file:px-2 sm:file:px-4 file:rounded-lg file:border-0 file:text-xs sm:file:text-sm file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                            />
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Previous Month Upload */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm sm:text-base">Plik Poprzedniego Miesiąca</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        <label className="text-xs sm:text-sm font-medium">Prześlij plik Excel z poprzedniego miesiąca</label>
                        <input
                          type="file"
                          accept=".xlsx,.xls"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              setPreviousMonthFile(file)
                            }
                          }}
                          className="block w-full text-xs sm:text-sm text-gray-500 file:mr-2 sm:file:mr-4 file:py-2 file:px-2 sm:file:px-4 file:rounded-lg file:border-0 file:text-xs sm:file:text-sm file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                        />
                        {previousMonthFile && (
                          <p className="text-xs text-green-600 break-all flex items-center gap-1">
                            <Check className="w-3 h-3" /> Wybrano: {previousMonthFile.name}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Compare Button */}
                <div className="flex justify-center">
                  <Button
                    onClick={handleMonthlyComparison}
                    disabled={!previousMonthFile || (!useCurrentAggregation && aggregatedData.length === 0)}
                    className="gap-2"
                    size="lg"
                  >
                    <BarChart className="w-4 h-4" />
                    Porównaj Inwentarze Miesięczne
                  </Button>
                </div>

                {/* Comparison Results */}
                {comparisonData && (
                  <div className="space-y-6">
                    {/* Alerts Section */}
                    {comparisonAlerts.length > 0 && (
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold">Ważne Alerty</h3>
                        <div className="space-y-2">
                          {comparisonAlerts.map((alert, index) => (
                            <div
                              key={index}
                              className={`p-4 rounded-lg border ${
                                alert.level === 'critical'
                                  ? 'border-red-200 bg-red-50 text-red-800'
                                  : alert.level === 'warning'
                                  ? 'border-yellow-200 bg-yellow-50 text-yellow-800'
                                  : 'border-blue-200 bg-blue-50 text-blue-800'
                              }`}
                            >
                              <p className="font-medium">{alert.message}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Detailed Comparison */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Szczegółowe Porównanie</h3>
                      
                      {/* Summary Stats */}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                        <Card>
                          <CardContent className="pt-4 sm:pt-6">
                            <div className="text-lg sm:text-2xl font-bold text-red-600">
                              {comparisonData.filter(d => d.type === 'missing').length}
                            </div>
                            <p className="text-xs sm:text-sm text-muted-foreground">Brakujące produkty</p>
                          </CardContent>
                        </Card>
                        
                        <Card>
                          <CardContent className="pt-4 sm:pt-6">
                            <div className="text-lg sm:text-2xl font-bold text-yellow-600">
                              {comparisonData.filter(d => d.type === 'decrease').length}
                            </div>
                            <p className="text-xs sm:text-sm text-muted-foreground">Spadki ilości</p>
                          </CardContent>
                        </Card>
                        
                        <Card>
                          <CardContent className="pt-4 sm:pt-6">
                            <div className="text-lg sm:text-2xl font-bold text-green-600">
                              {comparisonData.filter(d => d.type === 'increase').length}
                            </div>
                            <p className="text-xs sm:text-sm text-muted-foreground">Wzrosty ilości</p>
                          </CardContent>
                        </Card>
                        
                        <Card>
                          <CardContent className="pt-4 sm:pt-6">
                            <div className="text-lg sm:text-2xl font-bold text-blue-600">
                              {comparisonData.filter(d => d.type === 'new').length}
                            </div>
                            <p className="text-xs sm:text-sm text-muted-foreground">Nowe produkty</p>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Comparison Tabs */}
                      <Tabs defaultValue="all" className="space-y-4">
                        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-5">
                          <TabsTrigger value="all" className="text-xs sm:text-sm">
                            Wszystkie ({comparisonData.length})
                          </TabsTrigger>
                          <TabsTrigger value="missing" className="text-xs sm:text-sm text-red-600">
                            Brakujące ({comparisonData.filter(d => d.type === 'missing').length})
                          </TabsTrigger>
                          <TabsTrigger value="decrease" className="text-xs sm:text-sm text-yellow-600">
                            Spadki ({comparisonData.filter(d => d.type === 'decrease').length})
                          </TabsTrigger>
                          <TabsTrigger value="increase" className="text-xs sm:text-sm text-green-600">
                            Wzrosty ({comparisonData.filter(d => d.type === 'increase').length})
                          </TabsTrigger>
                          <TabsTrigger value="new" className="text-xs sm:text-sm text-blue-600">
                            Nowe ({comparisonData.filter(d => d.type === 'new').length})
                          </TabsTrigger>
                        </TabsList>

                        {/* All Items */}
                        <TabsContent value="all">
                          <div className="space-y-2 max-h-96 overflow-y-auto">
                            {comparisonData.map((diff, index) => (
                              <div
                                key={index}
                                className={`p-4 rounded-lg border-l-4 ${
                                  diff.type === 'missing'
                                    ? 'border-red-500 bg-red-50'
                                    : diff.type === 'decrease'
                                    ? 'border-yellow-500 bg-yellow-50'
                                    : diff.type === 'increase'
                                    ? 'border-green-500 bg-green-50'
                                    : 'border-blue-500 bg-blue-50'
                                }`}
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Badge
                                        variant="outline"
                                        className={
                                          diff.type === 'missing'
                                            ? 'bg-red-100 text-red-800 border-red-300'
                                            : diff.type === 'decrease'
                                            ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                                            : diff.type === 'increase'
                                            ? 'bg-green-100 text-green-800 border-green-300'
                                            : 'bg-blue-100 text-blue-800 border-blue-300'
                                        }
                                      >
                                        {diff.type === 'missing'
                                          ? 'Brak'
                                          : diff.type === 'decrease'
                                          ? 'Spadek'
                                          : diff.type === 'increase'
                                          ? 'Wzrost'
                                          : 'Nowy'}
                                      </Badge>
                                      <h4 className="font-medium text-sm sm:text-base">{diff.name}</h4>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                      <div>
                                        <span className="text-muted-foreground">Poprzedni miesiąc:</span>
                                        <div className="font-mono font-medium">
                                          {diff.quantity1?.toFixed(2) || '0'} {diff.unit}
                                        </div>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Obecny miesiąc:</span>
                                        <div className="font-mono font-medium">
                                          {diff.quantity2?.toFixed(2) || '0'} {diff.unit}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div className="flex flex-col sm:text-right">
                                    <div className={`font-bold text-lg ${
                                      diff.difference > 0 ? 'text-green-600' : 'text-red-600'
                                    }`}>
                                      {diff.difference > 0 ? '+' : ''}{diff.difference?.toFixed(2)} {diff.unit}
                                    </div>
                                    <div className={`text-sm ${
                                      (diff.percentChange || 0) > 0 ? 'text-green-600' : 'text-red-600'
                                    }`}>
                                      {diff.percentChange !== undefined && diff.percentChange !== null ? 
                                        `${diff.percentChange > 0 ? '+' : ''}${diff.percentChange.toFixed(1)}%` : 
                                        'N/A'
                                      }
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </TabsContent>

                        {/* Missing Items */}
                        <TabsContent value="missing">
                          <div className="space-y-2 max-h-96 overflow-y-auto">
                            {comparisonData.filter(d => d.type === 'missing').map((diff, index) => (
                              <div key={index} className="p-4 rounded-lg border-l-4 border-red-500 bg-red-50">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                  <div className="flex-1">
                                    <h4 className="font-medium text-red-800 mb-2">{diff.name}</h4>
                                    <p className="text-sm text-red-700">
                                      Produkt całkowicie zniknął z inwentarza!
                                    </p>
                                    <div className="mt-2 text-sm">
                                      <span className="text-red-600">Poprzednia ilość: </span>
                                      <span className="font-mono font-medium">{diff.quantity1?.toFixed(2)} {diff.unit}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </TabsContent>

                        {/* Decrease Items */}
                        <TabsContent value="decrease">
                          <div className="space-y-2 max-h-96 overflow-y-auto">
                            {comparisonData.filter(d => d.type === 'decrease').map((diff, index) => (
                              <div key={index} className="p-4 rounded-lg border-l-4 border-yellow-500 bg-yellow-50">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                  <div className="flex-1">
                                    <h4 className="font-medium text-yellow-800 mb-2">{diff.name}</h4>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                      <div>
                                        <span className="text-yellow-600">Było: </span>
                                        <span className="font-mono font-medium">{diff.quantity1?.toFixed(2)} {diff.unit}</span>
                                      </div>
                                      <div>
                                        <span className="text-yellow-600">Jest: </span>
                                        <span className="font-mono font-medium">{diff.quantity2?.toFixed(2)} {diff.unit}</span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-bold text-lg text-red-600">
                                      {diff.difference?.toFixed(2)} {diff.unit}
                                    </div>
                                    <div className="text-sm text-red-600">
                                      {diff.percentChange?.toFixed(1)}%
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </TabsContent>

                        {/* Increase Items */}
                        <TabsContent value="increase">
                          <div className="space-y-2 max-h-96 overflow-y-auto">
                            {comparisonData.filter(d => d.type === 'increase').map((diff, index) => (
                              <div key={index} className="p-4 rounded-lg border-l-4 border-green-500 bg-green-50">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                  <div className="flex-1">
                                    <h4 className="font-medium text-green-800 mb-2">{diff.name}</h4>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                      <div>
                                        <span className="text-green-600">Było: </span>
                                        <span className="font-mono font-medium">{diff.quantity1?.toFixed(2)} {diff.unit}</span>
                                      </div>
                                      <div>
                                        <span className="text-green-600">Jest: </span>
                                        <span className="font-mono font-medium">{diff.quantity2?.toFixed(2)} {diff.unit}</span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-bold text-lg text-green-600">
                                      +{diff.difference?.toFixed(2)} {diff.unit}
                                    </div>
                                    <div className="text-sm text-green-600">
                                      +{diff.percentChange?.toFixed(1)}%
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </TabsContent>

                        {/* New Items */}
                        <TabsContent value="new">
                          <div className="space-y-2 max-h-96 overflow-y-auto">
                            {comparisonData.filter(d => d.type === 'new').map((diff, index) => (
                              <div key={index} className="p-4 rounded-lg border-l-4 border-blue-500 bg-blue-50">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                  <div className="flex-1">
                                    <h4 className="font-medium text-blue-800 mb-2">{diff.name}</h4>
                                    <p className="text-sm text-blue-700">
                                      Nowy produkt w inwentarzu
                                    </p>
                                    <div className="mt-2 text-sm">
                                      <span className="text-blue-600">Ilość: </span>
                                      <span className="font-mono font-medium">{diff.quantity2?.toFixed(2)} {diff.unit}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </TabsContent>
                      </Tabs>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}