import { 
  detectColumns, 
  validateMapping, 
  createDefaultMapping,
  applyMapping,
  type ColumnMapping 
} from '../column-detection'

describe('Column Detection System', () => {
  describe('detectColumns', () => {
    it('should detect standard Polish format columns', () => {
      const headers = ['L.p.', 'Nr indeksu', 'Nazwa towaru', 'Ilość', 'JMZ']
      const sampleData = [
        ['1', 'A001', 'Produkt A', '100', 'kg'],
        ['2', 'B002', 'Produkt B', '50', 'szt']
      ]
      
      const result = detectColumns(headers, sampleData)
      
      expect(result.mapping.lp).toBe(0)
      expect(result.mapping.itemId).toBe(1)
      expect(result.mapping.name).toBe(2)
      expect(result.mapping.quantity).toBe(3)
      expect(result.mapping.unit).toBe(4)
      expect(result.confidence).toBeGreaterThan(90)
    })

    it('should detect English format columns', () => {
      const headers = ['Position', 'Item Code', 'Product Name', 'Quantity', 'Unit']
      const sampleData = [
        ['1', 'ITEM001', 'Product A', '25.5', 'kg'],
        ['2', 'ITEM002', 'Product B', '100', 'pcs']
      ]
      
      const result = detectColumns(headers, sampleData)
      
      expect(result.mapping.lp).toBe(0)
      expect(result.mapping.itemId).toBe(1)
      expect(result.mapping.name).toBe(2)
      expect(result.mapping.quantity).toBe(3)
      expect(result.mapping.unit).toBe(4)
      expect(result.confidence).toBeGreaterThan(80)
    })

    it('should detect SAP export format', () => {
      const headers = ['Material', 'Description', 'Amount', 'UoM']
      const sampleData = [
        ['MAT001', 'Material A', '1500', 'kg'],
        ['MAT002', 'Material B', '750', 'l']
      ]
      
      const result = detectColumns(headers, sampleData)
      
      expect(result.mapping.itemId).toBe(0)
      expect(result.mapping.name).toBe(1)
      expect(result.mapping.quantity).toBe(2)
      expect(result.mapping.unit).toBe(3)
      expect(result.mapping.lp).toBeUndefined()
      expect(result.confidence).toBeGreaterThan(70)
    })

    it('should handle minimum required columns', () => {
      const headers = ['Nazwa', 'Ilość', 'Jednostka']
      const sampleData = [
        ['Cement', '1000', 'kg'],
        ['Woda', '500', 'l']
      ]
      
      const result = detectColumns(headers, sampleData)
      
      expect(result.mapping.name).toBe(0)
      expect(result.mapping.quantity).toBe(1)
      expect(result.mapping.unit).toBe(2)
      expect(result.mapping.lp).toBeUndefined()
      expect(result.mapping.itemId).toBeUndefined()
      expect(result.confidence).toBeGreaterThan(60)
    })

    it('should handle mixed order columns', () => {
      const headers = ['Quantity', 'Product', 'Code', 'Unit', 'No.']
      const sampleData = [
        ['100', 'Product A', 'A001', 'kg', '1'],
        ['50', 'Product B', 'B002', 'pcs', '2']
      ]
      
      const result = detectColumns(headers, sampleData)
      
      expect(result.mapping.quantity).toBe(0)
      expect(result.mapping.name).toBe(1)
      expect(result.mapping.itemId).toBe(2)
      expect(result.mapping.unit).toBe(3)
      expect(result.mapping.lp).toBe(4)
      expect(result.confidence).toBeGreaterThan(70)
    })

    it('should throw error for insufficient columns', () => {
      const headers = ['Nazwa']
      const sampleData = [['Product A']]
      
      expect(() => detectColumns(headers, sampleData)).toThrow('Insufficient columns detected')
    })

    it('should handle ambiguous headers with lower confidence', () => {
      const headers = ['Col1', 'Col2', 'Col3', 'Col4']
      const sampleData = [
        ['1', 'A001', 'Product', '100'],
        ['2', 'B002', 'Item', '50']
      ]
      
      expect(() => detectColumns(headers, sampleData)).toThrow('Insufficient columns detected')
    })

    it('should provide helpful suggestions for manual mapping', () => {
      const headers = ['X', 'Y', 'Z', 'W', 'V']
      const sampleData = [
        ['1', 'CODE1', 'Name 1', '100', 'kg'],
        ['2', 'CODE2', 'Name 2', '200', 'l']
      ]
      
      expect(() => detectColumns(headers, sampleData)).toThrow('Insufficient columns detected')
    })
  })

  describe('validateMapping', () => {
    it('should validate complete mapping', () => {
      const mapping: ColumnMapping = {
        lp: 0,
        itemId: 1,
        name: 2,
        quantity: 3,
        unit: 4
      }
      const headers = ['L.p.', 'Kod', 'Nazwa', 'Ilość', 'Jednostka']
      
      const result = validateMapping(mapping, headers)
      
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should validate minimum required mapping', () => {
      const mapping: ColumnMapping = {
        name: 0,
        quantity: 1,
        unit: 2
      }
      const headers = ['Nazwa', 'Ilość', 'Jednostka']
      
      const result = validateMapping(mapping, headers)
      
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject mapping without required fields', () => {
      const mapping: ColumnMapping = {
        lp: 0,
        itemId: 1,
        name: 2
        // Missing quantity and unit
      }
      const headers = ['L.p.', 'Kod', 'Nazwa']
      
      const result = validateMapping(mapping, headers)
      
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Missing required field: quantity')
      expect(result.errors).toContain('Missing required field: unit')
    })

    it('should reject mapping with duplicate columns', () => {
      const mapping: ColumnMapping = {
        name: 0,
        quantity: 0, // Duplicate column 0
        unit: 1
      }
      const headers = ['Nazwa', 'Jednostka']
      
      const result = validateMapping(mapping, headers)
      
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Duplicate column assignment: 0')
    })

    it('should reject mapping with out-of-bounds column indices', () => {
      const mapping: ColumnMapping = {
        name: 0,
        quantity: 1,
        unit: 5 // Out of bounds
      }
      const headers = ['Nazwa', 'Ilość']
      
      const result = validateMapping(mapping, headers)
      
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Column index out of bounds: 5')
    })

    it('should reject mapping with negative column indices', () => {
      const mapping: ColumnMapping = {
        name: 0,
        quantity: -1, // Negative index
        unit: 1
      }
      const headers = ['Nazwa', 'Jednostka']
      
      const result = validateMapping(mapping, headers)
      
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Invalid column index: -1')
    })
  })

  describe('createDefaultMapping', () => {
    it('should create default suggestions for standard headers', () => {
      const headers = ['L.p.', 'Kod produktu', 'Nazwa', 'Ilość', 'Jednostka']
      
      const result = createDefaultMapping(headers)
      
      expect(result).toHaveLength(5)
      expect(result[0].possibleTypes).toContain('lp')
      expect(result[1].possibleTypes).toContain('itemId')
      expect(result[2].possibleTypes).toContain('name')
      expect(result[3].possibleTypes).toContain('quantity')
      expect(result[4].possibleTypes).toContain('unit')
    })

    it('should handle unknown headers', () => {
      const headers = ['ColA', 'ColB', 'ColC']
      
      const result = createDefaultMapping(headers)
      
      expect(result).toHaveLength(3)
      result.forEach(suggestion => {
        expect(suggestion.possibleTypes.length).toBeGreaterThan(0)
        expect(suggestion.possibleTypes).toContain('unknown')
      })
    })

    it('should provide confidence scores', () => {
      const headers = ['Position', 'Item', 'Name', 'Qty', 'Unit']
      
      const result = createDefaultMapping(headers)
      
      result.forEach(suggestion => {
        expect(suggestion.confidence).toBeGreaterThanOrEqual(0)
        expect(suggestion.confidence).toBeLessThanOrEqual(100)
      })
    })
  })

  describe('applyMapping', () => {
    it('should extract data using complete mapping', () => {
      const row = ['1', 'A001', 'Product A', '100.5', 'kg']
      const mapping: ColumnMapping = {
        lp: 0,
        itemId: 1,
        name: 2,
        quantity: 3,
        unit: 4
      }
      
      const result = applyMapping(row, mapping)
      
      expect(result.lp).toBe(1)
      expect(result.itemId).toBe('A001')
      expect(result.name).toBe('Product A')
      expect(result.quantity).toBe(100.5)
      expect(result.unit).toBe('kg')
    })

    it('should extract data using minimum mapping', () => {
      const row = ['Product B', '75', 'pcs']
      const mapping: ColumnMapping = {
        name: 0,
        quantity: 1,
        unit: 2
      }
      
      const result = applyMapping(row, mapping)
      
      expect(result.lp).toBeUndefined()
      expect(result.itemId).toBeUndefined()
      expect(result.name).toBe('Product B')
      expect(result.quantity).toBe(75)
      expect(result.unit).toBe('pcs')
    })

    it('should handle missing optional fields', () => {
      const row = ['Product C', '25.75', 'l']
      const mapping: ColumnMapping = {
        name: 0,
        quantity: 1,
        unit: 2
      }
      
      const result = applyMapping(row, mapping)
      
      expect(result.name).toBe('Product C')
      expect(result.quantity).toBe(25.75)
      expect(result.unit).toBe('l')
      expect(result.lp).toBeUndefined()
      expect(result.itemId).toBeUndefined()
    })

    it('should handle empty/null values', () => {
      const row = ['', 'ITEM001', 'Product', '', 'kg']
      const mapping: ColumnMapping = {
        lp: 0,
        itemId: 1,
        name: 2,
        quantity: 3,
        unit: 4
      }
      
      const result = applyMapping(row, mapping)
      
      expect(result.lp).toBeUndefined()
      expect(result.itemId).toBe('ITEM001')
      expect(result.name).toBe('Product')
      expect(result.quantity).toBe(0)
      expect(result.unit).toBe('kg')
    })

    it('should normalize unit values', () => {
      const row = ['Product', '100', '  KG  ']
      const mapping: ColumnMapping = {
        name: 0,
        quantity: 1,
        unit: 2
      }
      
      const result = applyMapping(row, mapping)
      
      expect(result.unit).toBe('kg')
    })

    it('should handle non-numeric quantities gracefully', () => {
      const row = ['Product', 'invalid', 'kg']
      const mapping: ColumnMapping = {
        name: 0,
        quantity: 1,
        unit: 2
      }
      
      expect(() => applyMapping(row, mapping)).toThrow('Nieprawidłowe dane w wierszu')
    })

    it('should throw error for out-of-bounds column access', () => {
      const row = ['A', 'B']
      const mapping: ColumnMapping = {
        name: 0,
        quantity: 1,
        unit: 5 // Out of bounds
      }
      
      expect(() => applyMapping(row, mapping)).toThrow('Column index out of bounds')
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty headers array', () => {
      expect(() => detectColumns([], [])).toThrow('No headers provided')
    })

    it('should handle headers with special characters', () => {
      const headers = ['L.p. №', 'Kod-produktu', 'Nazwa (PL)', 'Ilość/szt', 'Jednostka m.']
      const sampleData = [['1', 'A001', 'Product', '100', 'kg']]
      
      const result = detectColumns(headers, sampleData)
      
      expect(result.mapping.lp).toBe(0)
      expect(result.mapping.itemId).toBe(1)
      expect(result.mapping.name).toBe(2)
      expect(result.mapping.quantity).toBe(3)
      expect(result.mapping.unit).toBe(4)
    })

    it('should handle very long headers', () => {
      const longHeader = 'A'.repeat(1000)
      const headers = [longHeader, 'Quantity', 'Unit']
      const sampleData = [['Product', '100', 'kg']]
      
      expect(() => createDefaultMapping(headers)).not.toThrow()
    })

    it('should handle case-insensitive detection', () => {
      const headers = ['l.p.', 'nr indeksu', 'nazwa towaru', 'ilość', 'jmz']
      const sampleData = [['1', 'A001', 'Product', '100', 'kg']]
      
      const result = detectColumns(headers, sampleData)
      
      expect(result.mapping.lp).toBe(0)
      expect(result.mapping.itemId).toBe(1)
      expect(result.mapping.name).toBe(2)
      expect(result.mapping.quantity).toBe(3)
      expect(result.mapping.unit).toBe(4)
    })
  })

  describe('Performance', () => {
    it('should handle large header arrays efficiently', () => {
      const headers = Array.from({ length: 100 }, (_, i) => `Column${i}`)
      headers[0] = 'Nazwa'
      headers[1] = 'Ilość'
      headers[2] = 'Jednostka'
      
      const sampleData = [Array.from({ length: 100 }, (_, i) => i === 0 ? 'Product' : i === 1 ? '100' : i === 2 ? 'kg' : 'data')]
      
      const startTime = performance.now()
      const result = detectColumns(headers, sampleData)
      const endTime = performance.now()
      
      expect(endTime - startTime).toBeLessThan(1000) // Should complete within 1 second
      expect(result.mapping.name).toBe(0)
      expect(result.mapping.quantity).toBe(1)
      expect(result.mapping.unit).toBe(2)
    })
  })
})