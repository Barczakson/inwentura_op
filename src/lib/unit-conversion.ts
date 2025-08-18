// Unit conversion utilities
export interface UnitConversion {
  from: string
  to: string
  factor: number
  offset?: number
}

// Common unit conversions
const UNIT_CONVERSIONS: Record<string, UnitConversion[]> = {
  // Weight conversions
  'g': [
    { from: 'g', to: 'kg', factor: 0.001 },
    { from: 'g', to: 'mg', factor: 1000 },
    { from: 'g', to: 'oz', factor: 0.035274 },
    { from: 'g', to: 'lb', factor: 0.00220462 }
  ],
  'kg': [
    { from: 'kg', to: 'g', factor: 1000 },
    { from: 'kg', to: 'mg', factor: 1000000 },
    { from: 'kg', to: 'oz', factor: 35.274 },
    { from: 'kg', to: 'lb', factor: 2.20462 }
  ],
  'mg': [
    { from: 'mg', to: 'g', factor: 0.001 },
    { from: 'mg', to: 'kg', factor: 0.000001 },
    { from: 'mg', to: 'oz', factor: 0.000035274 },
    { from: 'mg', to: 'lb', factor: 0.00000220462 }
  ],
  'oz': [
    { from: 'oz', to: 'g', factor: 28.3495 },
    { from: 'oz', to: 'kg', factor: 0.0283495 },
    { from: 'oz', to: 'mg', factor: 28349.5 },
    { from: 'oz', to: 'lb', factor: 0.0625 }
  ],
  'lb': [
    { from: 'lb', to: 'g', factor: 453.592 },
    { from: 'lb', to: 'kg', factor: 0.453592 },
    { from: 'lb', to: 'mg', factor: 453592 },
    { from: 'lb', to: 'oz', factor: 16 }
  ],

  // Volume conversions
  'l': [
    { from: 'l', to: 'ml', factor: 1000 },
    { from: 'l', to: 'fl oz', factor: 33.814 },
    { from: 'l', to: 'gal', factor: 0.264172 },
    { from: 'l', to: 'cup', factor: 4.22675 }
  ],
  'ml': [
    { from: 'ml', to: 'l', factor: 0.001 },
    { from: 'ml', to: 'fl oz', factor: 0.033814 },
    { from: 'ml', to: 'gal', factor: 0.000264172 },
    { from: 'ml', to: 'cup', factor: 0.00422675 }
  ],
  'fl oz': [
    { from: 'fl oz', to: 'l', factor: 0.0295735 },
    { from: 'fl oz', to: 'ml', factor: 29.5735 },
    { from: 'fl oz', to: 'gal', factor: 0.0078125 },
    { from: 'fl oz', to: 'cup', factor: 0.125 }
  ],
  'gal': [
    { from: 'gal', to: 'l', factor: 3.78541 },
    { from: 'gal', to: 'ml', factor: 3785.41 },
    { from: 'gal', to: 'fl oz', factor: 128 },
    { from: 'gal', to: 'cup', factor: 16 }
  ],
  'cup': [
    { from: 'cup', to: 'l', factor: 0.236588 },
    { from: 'cup', to: 'ml', factor: 236.588 },
    { from: 'cup', to: 'fl oz', factor: 8 },
    { from: 'cup', to: 'gal', factor: 0.0625 }
  ]
}

// Preferred display units (what to convert to for better readability)
const PREFERRED_UNITS: Record<string, string> = {
  'g': 'kg',      // Convert grams to kilograms when >= 1000g
  'mg': 'g',      // Convert milligrams to grams when >= 1000mg
  'ml': 'l',      // Convert milliliters to liters when >= 1000ml
  'fl oz': 'gal', // Convert fluid ounces to gallons when >= 128fl oz
}

// Thresholds for automatic conversion
const CONVERSION_THRESHOLDS: Record<string, number> = {
  'g': 1000,      // Convert to kg when >= 1000g
  'mg': 1000,     // Convert to g when >= 1000mg
  'ml': 1000,     // Convert to l when >= 1000ml
  'fl oz': 128,   // Convert to gal when >= 128fl oz
}

/**
 * Convert a quantity from one unit to another
 */
export function convertUnit(quantity: number, fromUnit: string, toUnit: string): number {
  if (fromUnit === toUnit) {
    return quantity
  }

  const conversions = UNIT_CONVERSIONS[fromUnit.toLowerCase()]
  if (!conversions) {
    throw new Error(`No conversion available from ${fromUnit} to ${toUnit}`)
  }

  const conversion = conversions.find(c => c.to === toUnit.toLowerCase())
  if (!conversion) {
    throw new Error(`No conversion available from ${fromUnit} to ${toUnit}`)
  }

  return (quantity * conversion.factor) + (conversion.offset || 0)
}

/**
 * Get the best display unit for a given quantity and unit
 */
export function getBestDisplayUnit(quantity: number, unit: string): string {
  const normalizedUnit = unit.toLowerCase()
  const threshold = CONVERSION_THRESHOLDS[normalizedUnit]
  const preferredUnit = PREFERRED_UNITS[normalizedUnit]

  if (threshold && preferredUnit && quantity >= threshold) {
    return preferredUnit
  }

  return unit
}

/**
 * Format a quantity with the most appropriate unit
 */
export function formatQuantityWithConversion(quantity: number, unit: string, precision: number = 2): string {
  // Handle special cases for certain units
  const normalizedUnit = unit.toLowerCase();
  
  try {
    // Special handling for weight units
    if (['g', 'mg', 'kg', 'oz', 'lb', 'gram', 'milligram', 'kilogram'].includes(normalizedUnit)) {
      // Handle aliases first
      let baseUnit = normalizedUnit;
      if (normalizedUnit === 'gram') baseUnit = 'g';
      if (normalizedUnit === 'milligram') baseUnit = 'mg';
      if (normalizedUnit === 'kilogram') baseUnit = 'kg';
      
      // For grams, convert to kg when >= 1000g (or <= -1000g for negative numbers)
      if (baseUnit === 'g' && (quantity >= 1000 || quantity <= -1000)) {
        const converted = quantity / 1000;
        return formatConvertedNumber(converted, precision) + ' kg';
      }
      
      // For milligrams, convert to grams when >= 1000mg (or <= -1000mg for negative numbers)
      if (baseUnit === 'mg' && (quantity >= 1000 || quantity <= -1000)) {
        const converted = quantity / 1000;
        return formatConvertedNumber(converted, precision) + ' g';
      }
      
      // For kilograms, don't convert (keep as is)
      if (baseUnit === 'kg') {
        return formatNonConvertedNumber(quantity, precision) + ' kg';
      }
      
      // For grams and milligrams (when not converted)
      if (baseUnit === 'g' || baseUnit === 'mg') {
        return formatNonConvertedNumber(quantity, precision) + ' ' + baseUnit;
      }
      
      // For other weight units, keep as is
      return formatNonConvertedNumber(quantity, precision) + ' ' + baseUnit;
    }
    
    // Special handling for volume units
    if (['l', 'ml', 'fl oz', 'gal', 'cup', 'milliliter', 'liter'].includes(normalizedUnit)) {
      // Handle aliases first
      let baseUnit = normalizedUnit;
      if (normalizedUnit === 'milliliter') baseUnit = 'ml';
      if (normalizedUnit === 'liter') baseUnit = 'l';
      
      // For milliliters, convert to liters when >= 1000ml (or <= -1000ml for negative numbers)
      if (baseUnit === 'ml' && (quantity >= 1000 || quantity <= -1000)) {
        const converted = quantity / 1000;
        return formatConvertedNumber(converted, precision) + ' l';
      }
      
      // For liters, don't convert (keep as is)
      if (baseUnit === 'l') {
        return formatNonConvertedNumber(quantity, precision) + ' l';
      }
      
      // For ml (when not converted)
      if (baseUnit === 'ml') {
        return formatNonConvertedNumber(quantity, precision) + ' ml';
      }
      
      // For other volume units, keep as is
      return formatNonConvertedNumber(quantity, precision) + ' ' + baseUnit;
    }
    
    // For other units, return as is with default formatting
    return formatNonConvertedNumber(quantity, precision) + ' ' + unit;
  } catch (error) {
    // Fallback to original formatting if conversion fails
    return formatNonConvertedNumber(quantity, precision) + ' ' + unit;
  }
}

/**
 * Format number for converted values - always use specified precision with trailing zeros
 */
function formatConvertedNumber(num: number, precision: number): string {
  return num.toFixed(precision);
}

/**
 * Format number for non-converted values - use minimal necessary precision
 */
function formatNonConvertedNumber(num: number, maxPrecision: number): string {
  // For integers, don't add decimal places
  if (Number.isInteger(num)) {
    return num.toString();
  }
  
  // For decimals, determine the minimum precision needed
  // Convert to string and analyze
  const str = num.toString();
  
  // If it's in scientific notation, convert to fixed
  if (str.includes('e')) {
    return num.toFixed(maxPrecision);
  }
  
  // If it has a decimal point already, preserve its precision
  if (str.includes('.')) {
    const decimalPart = str.split('.')[1];
    // Limit to maxPrecision but don't add unnecessary zeros
    if (decimalPart.length <= maxPrecision) {
      // Remove trailing zeros
      let result = str;
      if (result.includes('.')) {
        result = result.replace(/\\.?0+$/, '');
      }
      return result;
    }
  }
  
  // Fallback - use toFixed but remove trailing zeros
  let formatted = num.toFixed(maxPrecision);
  if (formatted.includes('.')) {
    formatted = formatted.replace(/\\.?0+$/, '');
  }
  return formatted;
}

/**
 * Get all available units for a category
 */
export function getUnitsByCategory(category: 'weight' | 'volume' | 'all' = 'all'): string[] {
  const weightUnits = ['g', 'kg', 'mg', 'oz', 'lb']
  const volumeUnits = ['l', 'ml', 'fl oz', 'gal', 'cup']
  
  switch (category) {
    case 'weight':
      return weightUnits
    case 'volume':
      return volumeUnits
    case 'all':
    default:
      return [...weightUnits, ...volumeUnits]
  }
}

/**
 * Check if two units are compatible (can be converted between each other)
 */
export function areUnitsCompatible(unit1: string, unit2: string): boolean {
  const normalizedUnit1 = unit1.toLowerCase()
  const normalizedUnit2 = unit2.toLowerCase()
  
  if (normalizedUnit1 === normalizedUnit2) {
    return true
  }
  
  const conversions = UNIT_CONVERSIONS[normalizedUnit1]
  return conversions?.some(c => c.to === normalizedUnit2) || false
}

/**
 * Get conversion factor between two units
 */
export function getConversionFactor(fromUnit: string, toUnit: string): number {
  if (fromUnit === toUnit) {
    return 1
  }

  const conversions = UNIT_CONVERSIONS[fromUnit.toLowerCase()]
  if (!conversions) {
    throw new Error(`No conversion available from ${fromUnit}`)
  }

  const conversion = conversions.find(c => c.to === toUnit.toLowerCase())
  if (!conversion) {
    throw new Error(`No conversion available from ${fromUnit} to ${toUnit}`)
  }

  return conversion.factor
}