/**
 * File validation utilities for Excel uploads
 */

export interface FileValidationResult {
  isValid: boolean
  error?: string
  warnings?: string[]
}

// Constants
export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
export const ALLOWED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
  'application/octet-stream' // Sometimes Excel files are detected as this
]
export const ALLOWED_EXTENSIONS = ['.xlsx', '.xls']

/**
 * Validates file size, type, and extension
 */
export function validateFile(file: File): FileValidationResult {
  const warnings: string[] = []

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      isValid: false,
      error: `Plik jest za duży. Maksymalny rozmiar to ${MAX_FILE_SIZE / 1024 / 1024}MB, a Twój plik ma ${(file.size / 1024 / 1024).toFixed(2)}MB.`
    }
  }

  // Check file extension
  const extension = getFileExtension(file.name)
  if (!ALLOWED_EXTENSIONS.includes(extension.toLowerCase())) {
    return {
      isValid: false,
      error: `Nieprawidłowe rozszerzenie pliku. Dozwolone rozszerzenia: ${ALLOWED_EXTENSIONS.join(', ')}`
    }
  }

  // Check MIME type (with warning for questionable types)
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    if (file.type === 'application/octet-stream') {
      warnings.push('Typ pliku nie został rozpoznany automatycznie, ale rozszerzenie jest prawidłowe.')
    } else {
      warnings.push(`Nietypowy typ MIME: ${file.type}. Sprawdź czy plik nie jest uszkodzony.`)
    }
  }

  // Check for suspiciously small files
  if (file.size < 100) {
    return {
      isValid: false,
      error: 'Plik jest podejrzanie mały. Sprawdź czy to rzeczywiście plik Excel.'
    }
  }

  // Check for suspiciously large files
  if (file.size > 5 * 1024 * 1024) { // 5MB warning threshold
    warnings.push('Plik jest bardzo duży. Przetwarzanie może zająć więcej czasu.')
  }

  return {
    isValid: true,
    warnings: warnings.length > 0 ? warnings : undefined
  }
}

/**
 * Validates Excel file structure by attempting to read it
 */
export async function validateExcelStructure(file: File): Promise<FileValidationResult> {
  try {
    // Try to read the file as ArrayBuffer
    const buffer = await file.arrayBuffer()
    
    // Check if it looks like a ZIP file (XLSX format)
    const header = new Uint8Array(buffer.slice(0, 4))
    const isZip = header[0] === 0x50 && header[1] === 0x4B && header[2] === 0x03 && header[3] === 0x04

    if (file.name.endsWith('.xlsx') && !isZip) {
      return {
        isValid: false,
        error: 'Plik ma rozszerzenie .xlsx ale nie jest prawidłowym plikiem XLSX.'
      }
    }

    // Check for minimum Excel file structure
    if (buffer.byteLength < 512) {
      return {
        isValid: false,
        error: 'Plik jest za mały aby być prawidłowym plikiem Excel.'
      }
    }

    return { isValid: true }
  } catch (error) {
    return {
      isValid: false,
      error: 'Nie udało się przeczytać pliku. Sprawdź czy plik nie jest uszkodzony.'
    }
  }
}

/**
 * Get file extension from filename
 */
function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.')
  return lastDot === -1 ? '' : filename.slice(lastDot)
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Generate validation summary for UI display
 */
export function getValidationSummary(result: FileValidationResult, file: File): string {
  if (!result.isValid) {
    return result.error || 'Plik jest nieprawidłowy'
  }

  let summary = `✅ Plik prawidłowy (${formatFileSize(file.size)})`
  
  if (result.warnings && result.warnings.length > 0) {
    summary += `\n⚠️ Ostrzeżenia: ${result.warnings.join(', ')}`
  }

  return summary
}