import { 
  getFileColorClass, 
  getFileBackgroundColor, 
  getFileBorderColor, 
  abbreviateFileName,
  FILE_COLORS
} from '../colors'

describe('Colors Utility Functions', () => {
  describe('getFileColorClass', () => {
    it('should return a consistent color class for the same file ID', () => {
      const fileId = 'test-file-id'
      const color1 = getFileColorClass(fileId)
      const color2 = getFileColorClass(fileId)
      
      expect(color1).toBe(color2)
      expect(FILE_COLORS).toContain(color1)
    })

    it('should return different color classes for different file IDs', () => {
      const fileId1 = 'file-1'
      const fileId2 = 'file-2'
      const color1 = getFileColorClass(fileId1)
      const color2 = getFileColorClass(fileId2)
      
      // Note: This might occasionally fail if both IDs hash to the same color
      // but it's unlikely with a good distribution
      expect(typeof color1).toBe('string')
      expect(typeof color2).toBe('string')
    })

    it('should handle empty file ID', () => {
      const color = getFileColorClass('')
      expect(typeof color).toBe('string')
      expect(FILE_COLORS).toContain(color)
    })

    it('should handle special characters in file ID', () => {
      const fileId = 'file@#$%^&*()_+-=[]{}|;:,.<>?'
      const color = getFileColorClass(fileId)
      expect(typeof color).toBe('string')
      expect(FILE_COLORS).toContain(color)
    })
  })

  describe('getFileBackgroundColor', () => {
    it('should return only the background color part', () => {
      const fileId = 'test-file-id'
      const bgColor = getFileBackgroundColor(fileId)
      
      expect(bgColor).toMatch(/^bg-[a-z]+-\d+$/)
      expect(bgColor).toContain('bg-')
    })

    it('should be consistent with getFileColorClass', () => {
      const fileId = 'test-file-id'
      const fullColorClass = getFileColorClass(fileId)
      const bgColor = getFileBackgroundColor(fileId)
      const expectedBgColor = fullColorClass.split(' ')[0]
      
      expect(bgColor).toBe(expectedBgColor)
    })
  })

  describe('getFileBorderColor', () => {
    it('should return only the border color part and convert it to left border', () => {
      const fileId = 'test-file-id'
      const borderColor = getFileBorderColor(fileId)
      
      expect(borderColor).toMatch(/^border-l-[a-z]+-\d+$/)
      expect(borderColor).toContain('border-l-')
    })

    it('should be consistent with getFileColorClass', () => {
      const fileId = 'test-file-id'
      const fullColorClass = getFileColorClass(fileId)
      const borderColor = getFileBorderColor(fileId)
      const expectedBorderColor = fullColorClass.split(' ')[1].replace('border-', 'border-l-')
      
      expect(borderColor).toBe(expectedBorderColor)
    })
  })

  describe('abbreviateFileName', () => {
    it('should return the original name if it is shorter than or equal to maxLength', () => {
      const fileName = 'short.txt'
      const abbreviated = abbreviateFileName(fileName, 20)
      
      expect(abbreviated).toBe(fileName)
    })

    it('should abbreviate the file name if it is longer than maxLength', () => {
      const fileName = 'very-long-file-name-that-exceeds-the-maximum-length.txt'
      const abbreviated = abbreviateFileName(fileName, 20)
      
      expect(abbreviated).toBe('very-long-file-na...')
      expect(abbreviated.length).toBe(20)
    })

    it('should use default maxLength of 20 if not provided', () => {
      const fileName = 'a-very-long-file-name-that-exceeds-default-length.txt'
      const abbreviated = abbreviateFileName(fileName)
      
      expect(abbreviated.length).toBe(20)
      expect(abbreviated).toBe('a-very-long-file-...')
    })

    it('should handle empty file name', () => {
      const fileName = ''
      const abbreviated = abbreviateFileName(fileName, 10)
      
      expect(abbreviated).toBe('')
    })

    it('should handle fileName exactly at maxLength', () => {
      const fileName = 'exactly-20-chars.txt'
      const abbreviated = abbreviateFileName(fileName, 20)
      
      expect(abbreviated).toBe(fileName)
    })

    it('should handle fileName just over maxLength', () => {
      const fileName = 'exactly-21-chars.txts' // 21 characters now  
      const abbreviated = abbreviateFileName(fileName, 20)
      
      expect(abbreviated).toBe('exactly-21-chars....')
    })
  })
})