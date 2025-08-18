import { renderHook, act } from '@testing-library/react'
import { useToast, toast, reducer } from '../use-toast'

describe('useToast Hook', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should add a toast', () => {
    const { result } = renderHook(() => useToast())

    act(() => {
      toast({
        title: 'Test Toast',
        description: 'This is a test toast',
      })
    })

    expect(result.current.toasts).toHaveLength(1)
    expect(result.current.toasts[0]).toMatchObject({
      title: 'Test Toast',
      description: 'This is a test toast',
      open: true,
    })
  })

  it('should dismiss a toast', () => {
    const { result } = renderHook(() => useToast())

    let toastId: string | undefined

    act(() => {
      const toastResult = toast({
        title: 'Test Toast',
      })
      toastId = toastResult.id
    })

    expect(result.current.toasts[0].open).toBe(true)

    act(() => {
      result.current.dismiss(toastId)
    })

    expect(result.current.toasts[0].open).toBe(false)
  })

  it('should dismiss all toasts', () => {
    const { result } = renderHook(() => useToast())

    act(() => {
      toast({ title: 'Toast 1' })
      // Due to TOAST_LIMIT = 1, only one toast can exist at a time
    })

    expect(result.current.toasts).toHaveLength(1)
    expect(result.current.toasts[0].open).toBe(true)

    act(() => {
      result.current.dismiss()
    })

    expect(result.current.toasts[0].open).toBe(false)
  })

  it('should remove a toast after timeout', () => {
    const { result } = renderHook(() => useToast())

    act(() => {
      toast({
        title: 'Test Toast',
      })
    })

    expect(result.current.toasts).toHaveLength(1)

    act(() => {
      result.current.dismiss(result.current.toasts[0].id)
    })

    // Fast-forward timer
    act(() => {
      jest.advanceTimersByTime(1000000)
    })

    expect(result.current.toasts).toHaveLength(0)
  })

  it('should update a toast', () => {
    const { result } = renderHook(() => useToast())

    let toastId: string | undefined

    act(() => {
      const toastResult = toast({
        title: 'Original Toast',
        description: 'Original description',
      })
      toastId = toastResult.id
    })

    expect(result.current.toasts[0].title).toBe('Original Toast')
    expect(result.current.toasts[0].description).toBe('Original description')

    act(() => {
      toast({
        id: toastId,
        title: 'Updated Toast',
        description: 'Updated description',
      })
    })

    expect(result.current.toasts[0].title).toBe('Updated Toast')
    expect(result.current.toasts[0].description).toBe('Updated description')
  })

  it('should limit the number of toasts', () => {
    const { result } = renderHook(() => useToast())

    act(() => {
      // Add more toasts than the limit (1)
      toast({ title: 'Toast 1' })
      toast({ title: 'Toast 2' })
      toast({ title: 'Toast 3' })
    })

    expect(result.current.toasts).toHaveLength(1)
    expect(result.current.toasts[0].title).toBe('Toast 3') // Most recent should be kept
  })
})

describe('toast reducer', () => {
  it('should add a toast', () => {
    const state = { toasts: [] }
    const action = {
      type: 'ADD_TOAST' as const,
      toast: {
        id: '1',
        title: 'Test Toast',
        open: true,
      },
    }

    const newState = reducer(state, action)

    expect(newState.toasts).toHaveLength(1)
    expect(newState.toasts[0]).toMatchObject({
      id: '1',
      title: 'Test Toast',
      open: true,
    })
  })

  it('should update a toast', () => {
    const state = {
      toasts: [
        {
          id: '1',
          title: 'Original Toast',
          open: true,
        },
      ],
    }
    const action = {
      type: 'UPDATE_TOAST' as const,
      toast: {
        id: '1',
        title: 'Updated Toast',
      },
    }

    const newState = reducer(state, action)

    expect(newState.toasts).toHaveLength(1)
    expect(newState.toasts[0].title).toBe('Updated Toast')
  })

  it('should dismiss a specific toast', () => {
    const state = {
      toasts: [
        {
          id: '1',
          title: 'Toast 1',
          open: true,
        },
        {
          id: '2',
          title: 'Toast 2',
          open: true,
        },
      ],
    }
    const action = {
      type: 'DISMISS_TOAST' as const,
      toastId: '1',
    }

    const newState = reducer(state, action)

    expect(newState.toasts).toHaveLength(2)
    expect(newState.toasts[0].open).toBe(false)
    expect(newState.toasts[1].open).toBe(true)
  })

  it('should dismiss all toasts', () => {
    const state = {
      toasts: [
        {
          id: '1',
          title: 'Toast 1',
          open: true,
        },
        {
          id: '2',
          title: 'Toast 2',
          open: true,
        },
      ],
    }
    const action = {
      type: 'DISMISS_TOAST' as const,
    }

    const newState = reducer(state, action)

    expect(newState.toasts).toHaveLength(2)
    expect(newState.toasts[0].open).toBe(false)
    expect(newState.toasts[1].open).toBe(false)
  })

  it('should remove a specific toast', () => {
    const state = {
      toasts: [
        {
          id: '1',
          title: 'Toast 1',
        },
        {
          id: '2',
          title: 'Toast 2',
        },
      ],
    }
    const action = {
      type: 'REMOVE_TOAST' as const,
      toastId: '1',
    }

    const newState = reducer(state, action)

    expect(newState.toasts).toHaveLength(1)
    expect(newState.toasts[0].id).toBe('2')
  })

  it('should remove all toasts', () => {
    const state = {
      toasts: [
        {
          id: '1',
          title: 'Toast 1',
        },
        {
          id: '2',
          title: 'Toast 2',
        },
      ],
    }
    const action = {
      type: 'REMOVE_TOAST' as const,
    }

    const newState = reducer(state, action)

    expect(newState.toasts).toHaveLength(0)
  })
})