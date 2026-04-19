import { describe, it, expect } from 'vitest'
import { cn, getInitials, truncate } from '@/lib/utils'

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('deduplicates conflicting Tailwind classes (last wins)', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })

  it('handles conditional classes', () => {
    expect(cn('base', false && 'skip', 'include')).toBe('base include')
  })

  it('returns empty string for no inputs', () => {
    expect(cn()).toBe('')
  })

  it('merges arrays and objects', () => {
    expect(cn(['foo', 'bar'], { baz: true, qux: false })).toBe('foo bar baz')
  })
})

describe('getInitials', () => {
  it('returns initials for a full name', () => {
    expect(getInitials('John Doe')).toBe('JD')
  })

  it('returns single initial for single word name', () => {
    expect(getInitials('Alice')).toBe('A')
  })

  it('returns only first two words initials', () => {
    expect(getInitials('John Middle Doe')).toBe('JM')
  })

  it('returns "?" for null', () => {
    expect(getInitials(null)).toBe('?')
  })

  it('returns "?" for undefined', () => {
    expect(getInitials(undefined)).toBe('?')
  })

  it('returns "?" for empty string', () => {
    expect(getInitials('')).toBe('?')
  })

  it('returns uppercase initials', () => {
    expect(getInitials('alice bob')).toBe('AB')
  })
})

describe('truncate', () => {
  it('returns the original string if shorter than limit', () => {
    expect(truncate('hello', 10)).toBe('hello')
  })

  it('truncates and adds ellipsis when over limit', () => {
    const result = truncate('hello world', 5)
    expect(result).toBe('hello…')
    expect(result.length).toBe(6)
  })

  it('uses default limit of 60', () => {
    const long = 'a'.repeat(61)
    const result = truncate(long)
    expect(result.endsWith('…')).toBe(true)
    expect(result.length).toBe(61)
  })

  it('returns empty string for null', () => {
    expect(truncate(null)).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(truncate(undefined)).toBe('')
  })

  it('does not truncate string exactly at limit', () => {
    const str = 'a'.repeat(60)
    expect(truncate(str, 60)).toBe(str)
  })
})
