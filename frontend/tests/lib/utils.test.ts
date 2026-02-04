import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { formatBytes, formatPercentage, formatRelativeTime, debounce, sleep } from '@/lib/utils'

describe('formatBytes', () => {
  it('formats 0 bytes correctly', () => {
    expect(formatBytes(0)).toBe('0 Bytes')
  })

  it('formats bytes correctly', () => {
    expect(formatBytes(512)).toBe('512 Bytes')
    expect(formatBytes(1023)).toBe('1023 Bytes')
  })

  it('formats kilobytes correctly', () => {
    expect(formatBytes(1024)).toBe('1 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(10240)).toBe('10 KB')
  })

  it('formats megabytes correctly', () => {
    expect(formatBytes(1048576)).toBe('1 MB')
    expect(formatBytes(5242880)).toBe('5 MB')
  })

  it('formats gigabytes correctly', () => {
    expect(formatBytes(1073741824)).toBe('1 GB')
    expect(formatBytes(5368709120)).toBe('5 GB')
  })

  it('formats terabytes correctly', () => {
    expect(formatBytes(1099511627776)).toBe('1 TB')
  })

  it('respects custom decimal places', () => {
    expect(formatBytes(1536, 0)).toBe('2 KB')
    expect(formatBytes(1536, 1)).toBe('1.5 KB')
    // Note: parseFloat removes trailing zeros, so 1.500 becomes 1.5
    expect(formatBytes(1536, 3)).toBe('1.5 KB')
  })

  it('defaults to 2 decimal places', () => {
    expect(formatBytes(1234567)).toBe('1.18 MB')
  })
})

describe('formatPercentage', () => {
  it('formats percentage with default 1 decimal', () => {
    expect(formatPercentage(50.5)).toBe('50.5%')
    expect(formatPercentage(99.9)).toBe('99.9%')
  })

  it('formats percentage with custom decimals', () => {
    expect(formatPercentage(50.555, 0)).toBe('51%')
    // toFixed rounds, so 50.555 with 2 decimals becomes 50.55 (banker's rounding in JS)
    expect(formatPercentage(50.555, 2)).toBe('50.55%')
    expect(formatPercentage(50.555, 3)).toBe('50.555%')
  })

  it('handles zero correctly', () => {
    expect(formatPercentage(0)).toBe('0.0%')
  })

  it('handles 100 correctly', () => {
    expect(formatPercentage(100)).toBe('100.0%')
  })
})

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('formats "just now" for recent times', () => {
    const now = new Date()
    vi.setSystemTime(now)
    
    const recent = new Date(now.getTime() - 30 * 1000) // 30 seconds ago
    expect(formatRelativeTime(recent)).toBe('just now')
  })

  it('formats minutes ago', () => {
    const now = new Date()
    vi.setSystemTime(now)
    
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)
    expect(formatRelativeTime(fiveMinutesAgo)).toBe('5m ago')
  })

  it('formats hours ago', () => {
    const now = new Date()
    vi.setSystemTime(now)
    
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000)
    expect(formatRelativeTime(twoHoursAgo)).toBe('2h ago')
  })

  it('formats days ago', () => {
    const now = new Date()
    vi.setSystemTime(now)
    
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
    expect(formatRelativeTime(threeDaysAgo)).toBe('3d ago')
  })

  it('formats months ago', () => {
    const now = new Date()
    vi.setSystemTime(now)
    
    const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000) // ~2 months
    expect(formatRelativeTime(twoMonthsAgo)).toBe('2mo ago')
  })

  it('formats years ago', () => {
    const now = new Date()
    vi.setSystemTime(now)
    
    const twoYearsAgo = new Date(now.getTime() - 2 * 365 * 24 * 60 * 60 * 1000)
    expect(formatRelativeTime(twoYearsAgo)).toBe('2y ago')
  })

  it('accepts date strings', () => {
    const now = new Date()
    vi.setSystemTime(now)
    
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)
    expect(formatRelativeTime(fiveMinutesAgo.toISOString())).toBe('5m ago')
  })
})

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('delays function execution', () => {
    const fn = vi.fn()
    const debouncedFn = debounce(fn, 1000)

    debouncedFn()

    expect(fn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(999)
    expect(fn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('cancels previous calls', () => {
    const fn = vi.fn()
    const debouncedFn = debounce(fn, 1000)

    debouncedFn()
    vi.advanceTimersByTime(500)
    
    debouncedFn()
    vi.advanceTimersByTime(500)
    expect(fn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(500)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('passes arguments to function', () => {
    const fn = vi.fn()
    const debouncedFn = debounce(fn, 1000)

    debouncedFn('arg1', 'arg2')
    vi.advanceTimersByTime(1000)

    expect(fn).toHaveBeenCalledWith('arg1', 'arg2')
  })

  it('uses last arguments when called multiple times', () => {
    const fn = vi.fn()
    const debouncedFn = debounce(fn, 1000)

    debouncedFn('first')
    vi.advanceTimersByTime(500)
    
    debouncedFn('second')
    vi.advanceTimersByTime(1000)

    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('second')
  })
})

describe('sleep', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('resolves after specified time', async () => {
    const callback = vi.fn()
    
    sleep(1000).then(callback)

    expect(callback).not.toHaveBeenCalled()

    vi.advanceTimersByTime(999)
    await Promise.resolve()
    expect(callback).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    await Promise.resolve()
    expect(callback).toHaveBeenCalled()
  })

  it('works with async/await', async () => {
    const callback = vi.fn()

    const test = async () => {
      await sleep(500)
      callback()
    }

    test()

    expect(callback).not.toHaveBeenCalled()
    vi.advanceTimersByTime(500)
    await Promise.resolve()
    expect(callback).toHaveBeenCalled()
  })

  it('resolves with undefined', async () => {
    const promise = sleep(100)
    vi.advanceTimersByTime(100)
    
    const result = await promise
    expect(result).toBeUndefined()
  })
})
