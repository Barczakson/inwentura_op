import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import { DataCharts } from '../data-charts'

// Mock recharts components
jest.mock('recharts', () => ({
  BarChart: ({ children, data }: any) => (
    <div data-testid="bar-chart" data-chart-data={JSON.stringify(data)}>
      {children}
    </div>
  ),
  Bar: ({ dataKey, fill }: any) => (
    <div data-testid="bar" data-key={dataKey} data-fill={fill} />
  ),
  XAxis: ({ dataKey }: any) => (
    <div data-testid="x-axis" data-key={dataKey} />
  ),
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: ({ content }: any) => (
    <div data-testid="tooltip">{content}</div>
  ),
  Legend: () => <div data-testid="legend" />,
  PieChart: ({ children }: any) => (
    <div data-testid="pie-chart">{children}</div>
  ),
  Pie: ({ data, dataKey }: any) => (
    <div data-testid="pie" data-chart-data={JSON.stringify(data)} data-key={dataKey} />
  ),
  Cell: ({ fill }: any) => (
    <div data-testid="cell" data-fill={fill} />
  ),
  ResponsiveContainer: ({ children }: any) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  LineChart: ({ children }: any) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: ({ dataKey }: any) => (
    <div data-testid="line" data-key={dataKey} />
  ),
}))

const mockData = [
  {
    id: '1',
    itemId: 'A001',
    name: 'Product A',
    quantity: 100,
    unit: 'kg'
  },
  {
    id: '2',
    itemId: 'A002',
    name: 'Product B',
    quantity: 50,
    unit: 'l'
  },
  {
    id: '3',
    itemId: 'A003',
    name: 'Product C',
    quantity: 75,
    unit: 'kg'
  },
  {
    id: '4',
    itemId: 'A004',
    name: 'Product D',
    quantity: 25,
    unit: 'l'
  }
]

describe('DataCharts Component', () => {
  it('renders the main title and description', () => {
    render(<DataCharts data={mockData} />)
    
    expect(screen.getByText('Data Visualization')).toBeInTheDocument()
    expect(screen.getByText('Visual insights into your aggregated data')).toBeInTheDocument()
  })

  it('renders all three tabs', () => {
    render(<DataCharts data={mockData} />)
    
    expect(screen.getByText('Top Items')).toBeInTheDocument()
    expect(screen.getByText('Unit Distribution')).toBeInTheDocument()
    expect(screen.getByText('Summary')).toBeInTheDocument()
  })

  it('renders bar chart tab by default', () => {
    render(<DataCharts data={mockData} />)
    
    expect(screen.getByText('Top 10 Items by Quantity')).toBeInTheDocument()
    expect(screen.getByText('Your highest quantity items displayed in descending order')).toBeInTheDocument()
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
  })

  it('switches to pie chart tab when clicked', async () => {
    const user = userEvent.setup()
    render(<DataCharts data={mockData} />)

    await user.click(screen.getByText('Unit Distribution'))

    await waitFor(() => {
      expect(screen.getByText('Distribution by Unit')).toBeInTheDocument()
      expect(screen.getByText('How your quantities are distributed across different units')).toBeInTheDocument()
      expect(screen.getByTestId('pie-chart')).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('switches to summary tab when clicked', async () => {
    const user = userEvent.setup()
    render(<DataCharts data={mockData} />)

    await user.click(screen.getByText('Summary'))

    await waitFor(() => {
      expect(screen.getByText('Unit Summary')).toBeInTheDocument()
      expect(screen.getByText('Breakdown of quantities by unit type')).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('displays correct statistics in summary tab', async () => {
    const user = userEvent.setup()
    render(<DataCharts data={mockData} />)

    await user.click(screen.getByText('Summary'))

    await waitFor(() => {
      // Check for unit summary content
      expect(screen.getByText('Unit Summary')).toBeInTheDocument()
      expect(screen.getByText('Breakdown of quantities by unit type')).toBeInTheDocument()

      // Check for unit badges and quantities
      expect(screen.getByText('kg')).toBeInTheDocument()
      expect(screen.getByText('l')).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('groups data by unit correctly in summary', async () => {
    const user = userEvent.setup()
    render(<DataCharts data={mockData} />)

    await user.click(screen.getByText('Summary'))

    await waitFor(() => {
      // Should show kg unit with total 175 (100 + 75) and 2 items
      expect(screen.getByText('kg')).toBeInTheDocument()
      expect(screen.getByText('175.00')).toBeInTheDocument()
      expect(screen.getAllByText('2 items')).toHaveLength(2) // Both kg and l have 2 items each

      // Should show l unit with total 75 (50 + 25) and 2 items
      expect(screen.getByText('l')).toBeInTheDocument()
      expect(screen.getByText('75.00')).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('sorts bar chart data by quantity in descending order', () => {
    render(<DataCharts data={mockData} />)
    
    const barChart = screen.getByTestId('bar-chart')
    const chartData = JSON.parse(barChart.getAttribute('data-chart-data') || '[]')
    
    // Should be sorted by quantity descending
    expect(chartData[0].name).toBe('Product A')
    expect(chartData[0].quantity).toBe(100)
    expect(chartData[1].name).toBe('Product C')
    expect(chartData[1].quantity).toBe(75)
    expect(chartData[2].name).toBe('Product B')
    expect(chartData[2].quantity).toBe(50)
    expect(chartData[3].name).toBe('Product D')
    expect(chartData[3].quantity).toBe(25)
  })

  it('handles empty data gracefully', () => {
    render(<DataCharts data={[]} />)
    
    expect(screen.getByText('Data Visualization')).toBeInTheDocument()
    expect(screen.getByText('Top Items')).toBeInTheDocument()
    expect(screen.getByText('Unit Distribution')).toBeInTheDocument()
    expect(screen.getByText('Summary')).toBeInTheDocument()
  })

  it('handles data with same units correctly', async () => {
    const user = userEvent.setup()
    const sameUnitData = [
      { id: '1', name: 'Item 1', quantity: 10, unit: 'kg' },
      { id: '2', name: 'Item 2', quantity: 20, unit: 'kg' },
      { id: '3', name: 'Item 3', quantity: 30, unit: 'kg' }
    ]

    render(<DataCharts data={sameUnitData} />)

    await user.click(screen.getByText('Summary'))

    await waitFor(() => {
      expect(screen.getByText('kg')).toBeInTheDocument() // Unit badge
      expect(screen.getAllByText('60.00')).toHaveLength(2) // Total quantity appears in multiple places
      expect(screen.getByText('3 items')).toBeInTheDocument() // Total items
    }, { timeout: 3000 })
  })

  it('limits bar chart to top 10 items', () => {
    const manyItems = Array.from({ length: 15 }, (_, i) => ({
      id: `${i + 1}`,
      name: `Item ${i + 1}`,
      quantity: 100 - i,
      unit: 'kg'
    }))
    
    render(<DataCharts data={manyItems} />)
    
    const barChart = screen.getByTestId('bar-chart')
    const chartData = JSON.parse(barChart.getAttribute('data-chart-data') || '[]')
    
    expect(chartData).toHaveLength(10)
  })

  it('renders responsive containers for charts', async () => {
    const user = userEvent.setup()
    render(<DataCharts data={mockData} />)

    expect(screen.getAllByTestId('responsive-container')).toHaveLength(1) // Bar chart

    await user.click(screen.getByText('Unit Distribution'))

    await waitFor(() => {
      expect(screen.getAllByTestId('responsive-container')).toHaveLength(1) // Pie chart
    }, { timeout: 3000 })
  })
})
