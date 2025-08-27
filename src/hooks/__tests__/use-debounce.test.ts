import { renderHook, act } from '@testing-library/react'
import { useDebounce } from '../use-debounce'

describe('useDebounce Hook', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should return initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 500))
    
    expect(result.current).toBe('initial')
  })

  it('should debounce value changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 500 }
      }
    )

    expect(result.current).toBe('initial')

    // Change the value
    rerender({ value: 'updated', delay: 500 })

    // Value should still be the initial value before delay
    expect(result.current).toBe('initial')

    // Fast-forward time by less than the delay
    act(() => {
      jest.advanceTimersByTime(300)
    })

    // Value should still be the initial value
    expect(result.current).toBe('initial')

    // Fast-forward time to complete the delay
    act(() => {
      jest.advanceTimersByTime(200)
    })

    // Now the value should be updated
    expect(result.current).toBe('updated')
  })

  it('should reset timer when value changes before delay completes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 500 }
      }
    )

    expect(result.current).toBe('initial')

    // Change the value
    rerender({ value: 'first-update', delay: 500 })

    // Fast-forward time by less than the delay
    act(() => {
      jest.advanceTimersByTime(300)
    })

    // Change the value again before the first delay completes
    rerender({ value: 'second-update', delay: 500 })

    // Fast-forward time by the original remaining time
    act(() => {
      jest.advanceTimersByTime(200)
    })

    // Value should still be initial because the timer was reset
    expect(result.current).toBe('initial')

    // Fast-forward time to complete the new delay
    act(() => {
      jest.advanceTimersByTime(300)
    })

    // Now the value should be the second update
    expect(result.current).toBe('second-update')
  })

  it('should handle different delay values', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 1000 }
      }
    )

    expect(result.current).toBe('initial')

    // Change the value with a longer delay
    rerender({ value: 'updated', delay: 1000 })

    // Fast-forward time by less than the delay
    act(() => {
      jest.advanceTimersByTime(500)
    })

    expect(result.current).toBe('initial')

    // Fast-forward time to complete the delay
    act(() => {
      jest.advanceTimersByTime(500)
    })

    expect(result.current).toBe('updated')
  })

  it('should handle zero delay', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 0 }
      }
    )

    expect(result.current).toBe('initial')

    // Change the value with zero delay
    rerender({ value: 'updated', delay: 0 })

    // Even with zero delay, it should still use setTimeout
    expect(result.current).toBe('initial')

    // Fast-forward timers
    act(() => {
      jest.runAllTimers()
    })

    expect(result.current).toBe('updated')
  })

  it('should work with different data types', () => {
    // Test with numbers
    const { result: numberResult, rerender: numberRerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 1, delay: 500 }
      }
    )

    expect(numberResult.current).toBe(1)

    numberRerender({ value: 2, delay: 500 })

    act(() => {
      jest.advanceTimersByTime(500)
    })

    expect(numberResult.current).toBe(2)

    // Test with objects
    const initialObj = { name: 'initial' }
    const updatedObj = { name: 'updated' }

    const { result: objectResult, rerender: objectRerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: initialObj, delay: 500 }
      }
    )

    expect(objectResult.current).toBe(initialObj)

    objectRerender({ value: updatedObj, delay: 500 })

    act(() => {
      jest.advanceTimersByTime(500)
    })

    expect(objectResult.current).toBe(updatedObj)

    // Test with arrays
    const initialArray = [1, 2, 3]
    const updatedArray = [4, 5, 6]

    const { result: arrayResult, rerender: arrayRerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: initialArray, delay: 500 }
      }
    )

    expect(arrayResult.current).toBe(initialArray)

    arrayRerender({ value: updatedArray, delay: 500 })

    act(() => {
      jest.advanceTimersByTime(500)
    })

    expect(arrayResult.current).toBe(updatedArray)
  })

  it('should handle boolean values', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: false, delay: 500 }
      }
    )

    expect(result.current).toBe(false)

    rerender({ value: true, delay: 500 })

    act(() => {
      jest.advanceTimersByTime(500)
    })

    expect(result.current).toBe(true)
  })

  it('should handle null and undefined values', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: null, delay: 500 }
      }
    )

    expect(result.current).toBe(null)

    rerender({ value: undefined, delay: 500 })

    act(() => {
      jest.advanceTimersByTime(500)
    })

    expect(result.current).toBe(undefined)

    rerender({ value: 'not-null', delay: 500 })

    act(() => {
      jest.advanceTimersByTime(500)
    })

    expect(result.current).toBe('not-null')
  })

  it('should handle rapid value changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 500 }
      }
    )

    expect(result.current).toBe('initial')

    // Rapidly change values
    rerender({ value: 'change1', delay: 500 })
    
    act(() => {
      jest.advanceTimersByTime(100)
    })
    
    rerender({ value: 'change2', delay: 500 })
    
    act(() => {
      jest.advanceTimersByTime(100)
    })
    
    rerender({ value: 'change3', delay: 500 })
    
    act(() => {
      jest.advanceTimersByTime(100)
    })
    
    rerender({ value: 'final', delay: 500 })

    // Value should still be initial
    expect(result.current).toBe('initial')

    // Complete the final delay
    act(() => {
      jest.advanceTimersByTime(500)
    })

    // Should have the final value
    expect(result.current).toBe('final')
  })

  it('should handle delay changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 500 }
      }
    )

    expect(result.current).toBe('initial')

    // Change value and delay
    rerender({ value: 'updated', delay: 1000 })

    // Fast-forward by the original delay amount
    act(() => {
      jest.advanceTimersByTime(500)
    })

    // Should still be initial because delay was increased
    expect(result.current).toBe('initial')

    // Fast-forward by the remaining time
    act(() => {
      jest.advanceTimersByTime(500)
    })

    // Now should be updated
    expect(result.current).toBe('updated')
  })

  it('should cleanup timers on unmount', () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')
    
    const { unmount, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 500 }
      }
    )

    // Change value to trigger timer
    rerender({ value: 'updated', delay: 500 })

    // Unmount before timer completes
    unmount()

    // Verify clearTimeout was called
    expect(clearTimeoutSpy).toHaveBeenCalled()

    clearTimeoutSpy.mockRestore()
  })
})
