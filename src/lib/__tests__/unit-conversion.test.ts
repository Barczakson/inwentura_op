import { formatQuantityWithConversion } from '../unit-conversion'

describe('Unit Conversion', () => {
  describe('formatQuantityWithConversion', () => {
    // Weight conversions
    it('should convert grams to kilograms when >= 1000g', () => {
      expect(formatQuantityWithConversion(1000, 'g')).toBe('1.00 kg')
      expect(formatQuantityWithConversion(1500, 'g')).toBe('1.50 kg')
      expect(formatQuantityWithConversion(2750, 'g')).toBe('2.75 kg')
    })

    it('should keep grams when < 1000g', () => {
      expect(formatQuantityWithConversion(500, 'g')).toBe('500 g')
      expect(formatQuantityWithConversion(999, 'g')).toBe('999 g')
      expect(formatQuantityWithConversion(50.5, 'g')).toBe('50.5 g')
    })

    it('should convert milligrams to grams when >= 1000mg', () => {
      expect(formatQuantityWithConversion(1000, 'mg')).toBe('1.00 g')
      expect(formatQuantityWithConversion(2500, 'mg')).toBe('2.50 g')
      expect(formatQuantityWithConversion(1500, 'mg')).toBe('1.50 g')
    })

    it('should keep milligrams when < 1000mg', () => {
      expect(formatQuantityWithConversion(500, 'mg')).toBe('500 mg')
      expect(formatQuantityWithConversion(999, 'mg')).toBe('999 mg')
    })

    // Volume conversions
    it('should convert milliliters to liters when >= 1000ml', () => {
      expect(formatQuantityWithConversion(1000, 'ml')).toBe('1.00 l')
      expect(formatQuantityWithConversion(1500, 'ml')).toBe('1.50 l')
      expect(formatQuantityWithConversion(2250, 'ml')).toBe('2.25 l')
    })

    it('should keep milliliters when < 1000ml', () => {
      expect(formatQuantityWithConversion(500, 'ml')).toBe('500 ml')
      expect(formatQuantityWithConversion(999, 'ml')).toBe('999 ml')
    })

    // No conversion cases
    it('should not convert kilograms', () => {
      expect(formatQuantityWithConversion(1.5, 'kg')).toBe('1.5 kg')
      expect(formatQuantityWithConversion(0.5, 'kg')).toBe('0.5 kg')
    })

    it('should not convert liters', () => {
      expect(formatQuantityWithConversion(1.5, 'l')).toBe('1.5 l')
      expect(formatQuantityWithConversion(0.5, 'l')).toBe('0.5 l')
    })

    it('should not convert other units', () => {
      expect(formatQuantityWithConversion(10, 'pieces')).toBe('10 pieces')
      expect(formatQuantityWithConversion(5, 'boxes')).toBe('5 boxes')
      expect(formatQuantityWithConversion(2.5, 'meters')).toBe('2.5 meters')
    })

    // Edge cases
    it('should handle zero quantities', () => {
      expect(formatQuantityWithConversion(0, 'g')).toBe('0 g')
      expect(formatQuantityWithConversion(0, 'ml')).toBe('0 ml')
      expect(formatQuantityWithConversion(0, 'kg')).toBe('0 kg')
    })

    it('should handle decimal quantities with precision', () => {
      expect(formatQuantityWithConversion(1000.5, 'g', 4)).toBe('1.0005 kg')
      expect(formatQuantityWithConversion(1000.25, 'ml', 5)).toBe('1.00025 l')
    })

    it('should handle case-insensitive units', () => {
      expect(formatQuantityWithConversion(1000, 'G')).toBe('1.00 kg')
      expect(formatQuantityWithConversion(1000, 'ML')).toBe('1.00 l')
      expect(formatQuantityWithConversion(1000, 'MG')).toBe('1.00 g')
    })

    it('should format with default precision', () => {
      expect(formatQuantityWithConversion(2000, 'g')).toBe('2.00 kg')
      expect(formatQuantityWithConversion(3000, 'ml')).toBe('3.00 l')
      expect(formatQuantityWithConversion(4000, 'mg')).toBe('4.00 g')
    })
  })
})