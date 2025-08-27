import { renderHook, act } from '@testing-library/react'
import { useIsMobile } from '../use-mobile'

// Mock window.matchMedia
const mockMatchMedia = jest.fn()

describe('useIsMobile Hook', () => {
  beforeEach(() => {
    // Reset the mock
    mockMatchMedia.mockClear()
    
    // Mock window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: mockMatchMedia,
    })

    // Mock window.innerWidth
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      value: 1024,
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should return false for desktop width (>= 768px)', () => {
    const mockMql = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }
    
    mockMatchMedia.mockReturnValue(mockMql)
    
    // Set desktop width
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      value: 1024,
    })

    const { result } = renderHook(() => useIsMobile())

    expect(result.current).toBe(false)
    expect(mockMatchMedia).toHaveBeenCalledWith('(max-width: 767px)')
  })

  it('should return true for mobile width (< 768px)', () => {
    const mockMql = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }
    
    mockMatchMedia.mockReturnValue(mockMql)
    
    // Set mobile width
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      value: 600,
    })

    const { result } = renderHook(() => useIsMobile())

    expect(result.current).toBe(true)
  })

  it('should return true for exactly 767px (mobile breakpoint)', () => {
    const mockMql = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }
    
    mockMatchMedia.mockReturnValue(mockMql)
    
    // Set width to exactly the mobile breakpoint
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      value: 767,
    })

    const { result } = renderHook(() => useIsMobile())

    expect(result.current).toBe(true)
  })

  it('should return false for exactly 768px (desktop breakpoint)', () => {
    const mockMql = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }
    
    mockMatchMedia.mockReturnValue(mockMql)
    
    // Set width to exactly the desktop breakpoint
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      value: 768,
    })

    const { result } = renderHook(() => useIsMobile())

    expect(result.current).toBe(false)
  })

  it('should listen to media query changes', () => {
    const mockMql = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }
    
    mockMatchMedia.mockReturnValue(mockMql)

    renderHook(() => useIsMobile())

    expect(mockMql.addEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  })

  it('should update when window size changes', () => {
    let changeHandler: () => void
    const mockMql = {
      addEventListener: jest.fn((event, handler) => {
        if (event === 'change') {
          changeHandler = handler
        }
      }),
      removeEventListener: jest.fn(),
    }
    
    mockMatchMedia.mockReturnValue(mockMql)
    
    // Start with desktop width
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      value: 1024,
    })

    const { result } = renderHook(() => useIsMobile())

    expect(result.current).toBe(false)

    // Simulate window resize to mobile
    act(() => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        value: 600,
      })
      changeHandler()
    })

    expect(result.current).toBe(true)

    // Simulate window resize back to desktop
    act(() => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        value: 1024,
      })
      changeHandler()
    })

    expect(result.current).toBe(false)
  })

  it('should cleanup event listener on unmount', () => {
    const mockMql = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }
    
    mockMatchMedia.mockReturnValue(mockMql)

    const { unmount } = renderHook(() => useIsMobile())

    expect(mockMql.addEventListener).toHaveBeenCalled()

    unmount()

    expect(mockMql.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  })

  it('should handle edge case widths', () => {
    const mockMql = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }
    
    mockMatchMedia.mockReturnValue(mockMql)

    // Test very small width
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      value: 320,
    })

    const { result: smallResult } = renderHook(() => useIsMobile())
    expect(smallResult.current).toBe(true)

    // Test very large width
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      value: 1920,
    })

    const { result: largeResult } = renderHook(() => useIsMobile())
    expect(largeResult.current).toBe(false)

    // Test zero width (edge case)
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      value: 0,
    })

    const { result: zeroResult } = renderHook(() => useIsMobile())
    expect(zeroResult.current).toBe(true)
  })

  it('should handle multiple instances correctly', () => {
    const mockMql = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }
    
    mockMatchMedia.mockReturnValue(mockMql)
    
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      value: 600,
    })

    const { result: result1 } = renderHook(() => useIsMobile())
    const { result: result2 } = renderHook(() => useIsMobile())

    expect(result1.current).toBe(true)
    expect(result2.current).toBe(true)

    // Both should have the same value
    expect(result1.current).toBe(result2.current)
  })

  it('should return false when converted to boolean for undefined initial state', () => {
    const mockMql = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }
    
    mockMatchMedia.mockReturnValue(mockMql)

    // Mock a scenario where the initial state might be undefined
    const originalInnerWidth = window.innerWidth
    delete (window as any).innerWidth

    const { result } = renderHook(() => useIsMobile())

    // The hook should handle undefined gracefully and return false
    expect(result.current).toBe(false)

    // Restore
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      value: originalInnerWidth,
    })
  })

  it('should use correct breakpoint constant', () => {
    const mockMql = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }
    
    mockMatchMedia.mockReturnValue(mockMql)

    renderHook(() => useIsMobile())

    // Verify that the correct breakpoint (767px) is used in the media query
    expect(mockMatchMedia).toHaveBeenCalledWith('(max-width: 767px)')
  })
})
