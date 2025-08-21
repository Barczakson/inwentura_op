/**
 * Column Detection and Mapping System
 * 
 * Automatically detects and maps Excel columns to application fields
 * regardless of column order or naming variations.
 */

export interface ColumnMapping {
  lp?: number          // L.p. / Numer porządkowy
  itemId?: number      // Nr indeksu / Kod produktu / ID
  name: number         // Nazwa towaru / Produkt / Nazwa (REQUIRED)
  quantity: number     // Ilość / Qty / Liczba (REQUIRED)  
  unit: number         // JMZ / Jednostka / Unit (REQUIRED)
}

export interface DetectionResult {
  mapping: ColumnMapping
  confidence: number      // 0-1 score
  suggestions: { [key: string]: number[] }  // Alternative column suggestions
  headers: string[]      // Original headers
  sampleData: any[][]    // First few rows for preview
}

// Known column name patterns for automatic detection
const COLUMN_PATTERNS = {
  lp: [
    /^l\.?p\.?$/i,
    /^(numer|nr)?\s*(porządkowy|porzadkowy)$/i,
    /^(line|row)?\s*(number|nr|num)$/i,
    /^pozycja$/i,
    /^#$/,
  ],
  
  itemId: [
    /^(nr|numer)?\s*(indeks|index)$/i,
    /^(kod|code)\s*(produktu|product|towaru|item)?$/i,
    /^(id|identyfikator)$/i,
    /^(symbol|sku|part\s*number?)$/i,
    /^(item\s*)?(id|code|number)$/i,
  ],
  
  name: [
    /^nazwa\s*(towaru|produktu|item)?$/i,
    /^(produkt|product)\s*(name)?$/i,
    /^(item|товар|goods)\s*(name|nazwa)?$/i,
    /^(description|opis)$/i,
    /^material$/i,
  ],
  
  quantity: [
    /^(ilość|ilosc|qty|quantity)$/i,
    /^(liczba|amount|count)$/i,
    /^(stan|stock|inventory)$/i,
    /^(wartość|value|val)$/i,
  ],
  
  unit: [
    /^(jmz|jednostka|unit)$/i,
    /^(miara|measure|measurement)$/i,
    /^(um|u\.m\.?)$/i,
    /^(unit\s*of\s*measure|uom)$/i,
  ],
} as const

/**
 * Automatically detects column mapping from Excel headers
 */
export function detectColumns(
  headers: string[], 
  sampleRows: any[][] = []
): DetectionResult {
  const mapping: Partial<ColumnMapping> = {}
  const suggestions: { [key: string]: number[] } = {}
  const scores: { [key: string]: number[] } = {}
  
  // Initialize scores for each field
  Object.keys(COLUMN_PATTERNS).forEach(field => {
    scores[field] = new Array(headers.length).fill(0)
    suggestions[field] = []
  })
  
  // Score each header against patterns
  headers.forEach((header, index) => {
    const cleanHeader = header.trim()
    
    Object.entries(COLUMN_PATTERNS).forEach(([field, patterns]) => {
      patterns.forEach(pattern => {
        if (pattern.test(cleanHeader)) {
          scores[field][index] += 1
          
          // Bonus for exact matches
          if (cleanHeader.toLowerCase() === field.toLowerCase()) {
            scores[field][index] += 0.5
          }
        }
      })
      
      // Content-based detection for sample data
      if (sampleRows.length > 0) {
        const columnData = sampleRows.map(row => row[index]).filter(Boolean)
        
        if (field === 'quantity' && columnData.length > 0) {
          const numericCount = columnData.filter(val => !isNaN(parseFloat(val))).length
          if (numericCount / columnData.length > 0.8) {
            scores[field][index] += 0.3
          }
        }
        
        if (field === 'lp' && columnData.length > 0) {
          const sequentialCount = columnData.filter((val, i) => !isNaN(val) && val === i + 1).length
          if (sequentialCount / columnData.length > 0.5) {
            scores[field][index] += 0.4
          }
        }
      }
    })
  })
  
  // Find best matches and alternatives
  Object.keys(scores).forEach(field => {
    const fieldScores = scores[field]
    const maxScore = Math.max(...fieldScores)
    
    if (maxScore > 0) {
      const bestIndex = fieldScores.indexOf(maxScore)
      mapping[field as keyof ColumnMapping] = bestIndex
      
      // Find alternative suggestions
      suggestions[field] = fieldScores
        .map((score, index) => ({ score, index }))
        .filter(item => item.score > 0 && item.index !== bestIndex)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(item => item.index)
    }
  })
  
  // Calculate overall confidence
  const requiredFields = ['name', 'quantity', 'unit']
  const foundRequired = requiredFields.filter(field => mapping[field as keyof ColumnMapping] !== undefined)
  const confidence = foundRequired.length / requiredFields.length
  
  // Validate mapping - ensure required fields are present
  if (!mapping.name || !mapping.quantity || !mapping.unit) {
    throw new Error(`Nie można automatycznie wykryć wymaganych kolumn. Znaleziono: ${foundRequired.join(', ')}`)
  }
  
  return {
    mapping: mapping as ColumnMapping,
    confidence,
    suggestions,
    headers,
    sampleData: sampleRows.slice(0, 5), // First 5 rows for preview
  }
}

/**
 * Validates that a column mapping is complete and valid
 */
export function validateMapping(mapping: Partial<ColumnMapping>, headers: string[]): {
  isValid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Check required fields
  if (mapping.name === undefined) {
    errors.push('Kolumna "Nazwa towaru" jest wymagana')
  }
  if (mapping.quantity === undefined) {
    errors.push('Kolumna "Ilość" jest wymagana')
  }
  if (mapping.unit === undefined) {
    errors.push('Kolumna "Jednostka" jest wymagana')
  }
  
  // Check if column indices are valid
  Object.entries(mapping).forEach(([field, index]) => {
    if (index !== undefined && (index < 0 || index >= headers.length)) {
      errors.push(`Nieprawidłowy indeks kolumny dla pola "${field}": ${index}`)
    }
  })
  
  // Check for duplicate column assignments
  const usedIndices = Object.values(mapping).filter(index => index !== undefined)
  const duplicates = usedIndices.filter((index, i) => usedIndices.indexOf(index) !== i)
  if (duplicates.length > 0) {
    errors.push(`Kolumny nie mogą być przypisane do wielu pól: ${duplicates.join(', ')}`)
  }
  
  // Warnings
  if (mapping.lp === undefined) {
    warnings.push('Brak kolumny "L.p." - numery pozycji będą generowane automatycznie')
  }
  if (mapping.itemId === undefined) {
    warnings.push('Brak kolumny "Nr indeksu" - produkty będą identyfikowane tylko po nazwie')
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Creates a suggested mapping based on common Excel layouts
 */
export function createDefaultMapping(headers: string[]): ColumnMapping[] {
  const suggestions: ColumnMapping[] = []
  
  // Common layout 1: L.p. | Nr indeksu | Nazwa | Ilość | JMZ
  if (headers.length >= 5) {
    suggestions.push({
      lp: 0,
      itemId: 1,
      name: 2,
      quantity: 3,
      unit: 4,
    })
  }
  
  // Common layout 2: Nazwa | Ilość | Jednostka
  if (headers.length >= 3) {
    suggestions.push({
      name: 0,
      quantity: 1,
      unit: 2,
    })
  }
  
  // Common layout 3: ID | Nazwa | Ilość | Jednostka
  if (headers.length >= 4) {
    suggestions.push({
      itemId: 0,
      name: 1,
      quantity: 2,
      unit: 3,
    })
  }
  
  return suggestions
}

/**
 * Applies column mapping to extract data from a row
 */
export function applyMapping(row: any[], mapping: ColumnMapping): {
  lp?: number
  itemId?: string
  name: string
  quantity: number
  unit: string
} {
  const result = {
    lp: mapping.lp !== undefined ? Number(row[mapping.lp]) || undefined : undefined,
    itemId: mapping.itemId !== undefined ? String(row[mapping.itemId] || '').trim() || undefined : undefined,
    name: String(row[mapping.name] || '').trim(),
    quantity: parseFloat(String(row[mapping.quantity] || 0)),
    unit: String(row[mapping.unit] || '').trim().toLowerCase(),
  }
  
  // Validate extracted data
  if (!result.name || isNaN(result.quantity) || !result.unit) {
    throw new Error(`Nieprawidłowe dane w wierszu: nazwa="${result.name}", ilość="${result.quantity}", jednostka="${result.unit}"`)
  }
  
  return result
}