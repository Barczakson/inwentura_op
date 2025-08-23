/**
 * Vercel KV Adapter - Simple key-value storage for Excel Data Manager
 * Replaces complex database with simple Redis-like storage
 */

// Mock KV for local development
const mockKV = new Map<string, any>()

const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL

// KV interface - works locally and on Vercel
export const kv = {
  async get<T>(key: string): Promise<T | null> {
    if (isProduction) {
      const { kv: vercelKV } = await import('@vercel/kv')
      return await vercelKV.get<T>(key)
    } else {
      // Local development mock
      return mockKV.get(key) || null
    }
  },

  async set(key: string, value: any): Promise<void> {
    if (isProduction) {
      const { kv: vercelKV } = await import('@vercel/kv')
      await vercelKV.set(key, value)
    } else {
      // Local development mock
      mockKV.set(key, value)
    }
  },

  async del(key: string): Promise<void> {
    if (isProduction) {
      const { kv: vercelKV } = await import('@vercel/kv')
      await vercelKV.del(key)
    } else {
      // Local development mock
      mockKV.delete(key)
    }
  },

  async keys(pattern: string): Promise<string[]> {
    if (isProduction) {
      const { kv: vercelKV } = await import('@vercel/kv')
      return await vercelKV.keys(pattern)
    } else {
      // Local development mock - simple pattern matching
      const keys = Array.from(mockKV.keys())
      if (pattern === '*') return keys
      if (pattern.endsWith('*')) {
        const prefix = pattern.slice(0, -1)
        return keys.filter(key => key.startsWith(prefix))
      }
      return keys.filter(key => key === pattern)
    }
  }
}

// Data models for KV storage
export interface ExcelFileKV {
  id: string
  fileName: string
  fileSize: number
  rowCount: number
  uploadDate: string
  originalStructure?: string
  columnMapping?: string
  detectedHeaders?: string
}

export interface ExcelRowKV {
  id: string
  itemId?: string
  name: string
  quantity: number
  unit: string
  originalRowIndex?: number
  fileId: string
}

export interface AggregatedItemKV {
  id: string
  itemId?: string
  name: string
  quantity: number
  unit: string
  fileId?: string
  sourceFiles?: string
  count?: number
  createdAt: string
  updatedAt: string
}

// KV Database operations
export const kvDB = {
  // Files operations
  async getFiles(): Promise<ExcelFileKV[]> {
    const fileIds = await kv.keys('file:*')
    const files: ExcelFileKV[] = []
    
    for (const fileId of fileIds) {
      const file = await kv.get<ExcelFileKV>(fileId)
      if (file) files.push(file)
    }
    
    return files.sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime())
  },

  async saveFile(file: ExcelFileKV): Promise<void> {
    await kv.set(`file:${file.id}`, file)
  },

  async deleteFile(fileId: string): Promise<void> {
    await kv.del(`file:${fileId}`)
    
    // Delete associated rows
    const rowKeys = await kv.keys(`row:${fileId}:*`)
    for (const rowKey of rowKeys) {
      await kv.del(rowKey)
    }
  },

  // Rows operations
  async getRows(fileId?: string): Promise<ExcelRowKV[]> {
    const pattern = fileId ? `row:${fileId}:*` : 'row:*'
    const rowKeys = await kv.keys(pattern)
    const rows: ExcelRowKV[] = []
    
    for (const rowKey of rowKeys) {
      const row = await kv.get<ExcelRowKV>(rowKey)
      if (row) rows.push(row)
    }
    
    return rows
  },

  async saveRow(row: ExcelRowKV): Promise<void> {
    await kv.set(`row:${row.fileId}:${row.id}`, row)
  },

  async saveRows(rows: ExcelRowKV[]): Promise<void> {
    // Batch save rows
    for (const row of rows) {
      await this.saveRow(row)
    }
  },

  // Aggregated items operations
  async getAggregatedItems(): Promise<AggregatedItemKV[]> {
    const itemKeys = await kv.keys('aggregated:*')
    const items: AggregatedItemKV[] = []
    
    for (const itemKey of itemKeys) {
      const item = await kv.get<AggregatedItemKV>(itemKey)
      if (item) items.push(item)
    }
    
    return items.sort((a, b) => a.name.localeCompare(b.name))
  },

  async saveAggregatedItem(item: AggregatedItemKV): Promise<void> {
    await kv.set(`aggregated:${item.id}`, item)
  },

  async deleteAggregatedItem(itemId: string): Promise<void> {
    await kv.del(`aggregated:${itemId}`)
  },

  async updateAggregatedItem(itemId: string, quantity: number): Promise<AggregatedItemKV | null> {
    const item = await kv.get<AggregatedItemKV>(`aggregated:${itemId}`)
    if (item) {
      item.quantity = quantity
      item.updatedAt = new Date().toISOString()
      await this.saveAggregatedItem(item)
      return item
    }
    return null
  },

  // Utility functions
  async clearAll(): Promise<void> {
    const allKeys = await kv.keys('*')
    for (const key of allKeys) {
      await kv.del(key)
    }
  },

  async getStats() {
    const files = await this.getFiles()
    const allRows = await this.getRows()
    const aggregated = await this.getAggregatedItems()
    
    return {
      filesCount: files.length,
      rowsCount: allRows.length,
      aggregatedCount: aggregated.length,
      totalSize: files.reduce((sum, f) => sum + f.fileSize, 0)
    }
  }
}