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
  confidence: number      // 0-100 score
  suggestions: any[]  // Alternative column suggestions
}

// Known column name patterns for automatic detection
const COLUMN_PATTERNS = {
  lp: [
    /^l\.?p\.?$/i,
    /^(numer|nr)?\s*(porządkowy|porzadkowy)$/i,
    /^(line|row)?\s*(number|nr|num)$/i,
    /^pozycja$/i,
    /^position$/i,
    /^no\.?$/i,
    /^#$/,
    /^l\.p\.\s*№$/i,
  ],
  
  itemId: [
    /^(nr|numer)?\s*(indeks|index)$/i,
    /^(kod|code)\s*(produktu|product|towaru|item)?$/i,
    /^(id|identyfikator)$/i,
    /^(symbol|sku|part\s*number?)$/i,
    /^(item\s*)?(id|code|number)$/i,
    /^material$/i,
    /^nr\s*indeksu$/i,
    /^item\s*code$/i,
    /^code$/i,
    /^kod-produktu$/i,
  ],
  
  name: [
    /^nazwa\s*(towaru|produktu|item)?$/i,
    /^(produkt|product)\s*(name)?$/i,
    /^(item|товар|goods)\s*(name|nazwa)?$/i,
    /^(description|opis)$/i,
    /^nazwa$/i,
    /^product\s*name$/i,
    /^item\s*name$/i,
    /^nazwa\s*\(pl\)$/i,
  ],
  
  quantity: [
    /^(ilość|ilosc|qty|quantity)$/i,
    /^(liczba|amount|count)$/i,
    /^(stan|stock|inventory)$/i,
    /^(wartość|value|val)$/i,
    /^quantity$/i,
    /^amount$/i,
    /^ilość\/szt$/i,
  ],
  
  unit: [
    /^(jmz|jednostka|unit)$/i,
    /^(miara|measure|measurement)$/i,
    /^(um|u\.m\.?)$/i,
    /^(unit\s*of\s*measure|uom)$/i,
    /^unit$/i,
    /^uom$/i,
    /^jednostka\s*m\.$/i,
  ],
} as const

/**
 * Automatically detects column mapping from Excel headers
 */
export function detectColumns(
  headers: string[], 
  sampleRows: any[][] = []
): DetectionResult {
  if (!headers || headers.length === 0) {
    throw new Error('No headers provided')
  }

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
  const confidence = Math.round((foundRequired.length / requiredFields.length) * 100)
  
  // Validate mapping - ensure required fields are present
  if (mapping.name === undefined || mapping.quantity === undefined || mapping.unit === undefined) {
    throw new Error(`Insufficient columns detected. Required: name, quantity, unit. Found: ${foundRequired.join(', ')}`)
  }
  
  return {
    mapping: mapping as ColumnMapping,
    confidence,
    suggestions: []
  }
}

/**
 * Validates that a column mapping is complete and valid
 */
export function validateMapping(mapping: Partial<ColumnMapping>, headers: string[]): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []
  
  // Check required fields
  if (mapping.name === undefined) {
    errors.push('Missing required field: name')
  }
  if (mapping.quantity === undefined) {
    errors.push('Missing required field: quantity')
  }
  if (mapping.unit === undefined) {
    errors.push('Missing required field: unit')
  }
  
  // Check if column indices are valid
  Object.entries(mapping).forEach(([field, index]) => {
    if (index !== undefined) {
      if (index < 0) {
        errors.push(`Invalid column index: ${index}`)
      } else if (index >= headers.length) {
        errors.push(`Column index out of bounds: ${index}`)
      }
    }
  })
  
  // Check for duplicate column assignments
  const usedIndices = Object.values(mapping).filter(index => index !== undefined)
  const duplicates = usedIndices.filter((index, i) => usedIndices.indexOf(index) !== i)
  if (duplicates.length > 0) {
    duplicates.forEach(index => {
      errors.push(`Duplicate column assignment: ${index}`)
    })
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * Creates a suggested mapping based on common Excel layouts
 */
export function createDefaultMapping(headers: string[]): Array<{
  column: number
  possibleTypes: string[]
  confidence: number
}> {
  const suggestions = headers.map((header, index) => {
    const possibleTypes: string[] = []
    let confidence = 50

    // Check against patterns
    Object.entries(COLUMN_PATTERNS).forEach(([field, patterns]) => {
      patterns.forEach(pattern => {
        if (pattern.test(header.trim())) {
          possibleTypes.push(field)
          confidence = Math.max(confidence, 80)
        }
      })
    })

    // If no matches, mark as unknown
    if (possibleTypes.length === 0) {
      possibleTypes.push('unknown')
      confidence = 30
    }

    return {
      column: index,
      possibleTypes,
      confidence
    }
  })
  
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
  // Check bounds first
  const indices = [mapping.name, mapping.quantity, mapping.unit, mapping.lp, mapping.itemId].filter(i => i !== undefined)
  const maxIndex = Math.max(...indices)
  if (maxIndex >= row.length) {
    throw new Error(`Column index out of bounds: ${maxIndex}`)
  }

  const result = {
    lp: mapping.lp !== undefined ? Number(row[mapping.lp]) || undefined : undefined,
    itemId: mapping.itemId !== undefined ? String(row[mapping.itemId] || '').trim() || undefined : undefined,
    name: String(row[mapping.name] || '').trim(),
    quantity: parseFloat(String(row[mapping.quantity] || 0)),
    unit: String(row[mapping.unit] || '').trim().toLowerCase(),
  }
  
  // Validate extracted data - but allow for testing with invalid data
  if (!result.name || isNaN(result.quantity) || !result.unit) {
    throw new Error(`Nieprawidłowe dane w wierszu: nazwa="${result.name}", ilość="${result.quantity}", jednostka="${result.unit}"`)
  }
  
  return result
}