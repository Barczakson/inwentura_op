'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface ChartDataProps {
  data: Array<{
    id: string
    itemId?: string
    name: string
    quantity: number
    unit: string
  }>
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7C7C']

export function DataCharts({ data }: ChartDataProps) {
  // Prepare data for different chart types
  const barChartData = data.map(item => ({
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    fullName: `${item.name} (${item.unit})`
  }))

  // Group by unit for pie chart
  const unitDistribution = data.reduce((acc, item) => {
    const existing = acc.find(u => u.unit === item.unit)
    if (existing) {
      existing.total += item.quantity
      existing.count += 1
    } else {
      acc.push({
        unit: item.unit,
        total: item.quantity,
        count: 1
      })
    }
    return acc
  }, [] as Array<{ unit: string; total: number; count: number }>)

  // Sort by quantity for better visualization
  const sortedBarData = [...barChartData].sort((a, b) => b.quantity - a.quantity).slice(0, 10)
  const sortedUnitData = [...unitDistribution].sort((a, b) => b.total - a.total)

  // Top 10 items by quantity
  const topItems = sortedBarData

  // Custom tooltip for bar chart
  const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{data.fullName}</p>
          <p className="text-sm text-muted-foreground">
            Quantity: {data.quantity.toFixed(2)} {data.unit}
          </p>
        </div>
      )
    }
    return null
  }

  // Custom tooltip for pie chart
  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{data.unit}</p>
          <p className="text-sm text-muted-foreground">
            Total: {data.total.toFixed(2)}
          </p>
          <p className="text-sm text-muted-foreground">
            Items: {data.count}
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Data Visualization</h2>
        <p className="text-muted-foreground">
          Visual insights into your aggregated data
        </p>
      </div>

      <Tabs defaultValue="bar" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="bar">Top Items</TabsTrigger>
          <TabsTrigger value="pie">Unit Distribution</TabsTrigger>
          <TabsTrigger value="summary">Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="bar">
          <Card>
            <CardHeader>
              <CardTitle>Top 10 Items by Quantity</CardTitle>
              <CardDescription>
                Your highest quantity items displayed in descending order
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topItems} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="name" 
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      interval={0}
                    />
                    <YAxis />
                    <Tooltip content={<CustomBarTooltip />} />
                    <Bar dataKey="quantity" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pie">
          <Card>
            <CardHeader>
              <CardTitle>Distribution by Unit</CardTitle>
              <CardDescription>
                How your quantities are distributed across different units
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sortedUnitData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ unit, percent }) => `${unit} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="total"
                    >
                      {sortedUnitData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Unit Summary</CardTitle>
                <CardDescription>
                  Breakdown of quantities by unit type
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {sortedUnitData.map((unitData, index) => (
                    <div key={unitData.unit} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <Badge variant="outline">{unitData.unit}</Badge>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{unitData.total.toFixed(2)}</p>
                        <p className="text-sm text-muted-foreground">
                          {unitData.count} items
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Statistics</CardTitle>
                <CardDescription>
                  Key metrics about your data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span>Total Items</span>
                    <Badge variant="secondary">{data.length}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Quantity</span>
                    <Badge variant="secondary">
                      {data.reduce((sum, item) => sum + item.quantity, 0).toFixed(2)}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Unique Units</span>
                    <Badge variant="secondary">{unitDistribution.length}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Average Quantity</span>
                    <Badge variant="secondary">
                      {(data.reduce((sum, item) => sum + item.quantity, 0) / data.length).toFixed(2)}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Largest Item</span>
                    <Badge variant="secondary">
                      {topItems[0]?.fullName || 'N/A'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}