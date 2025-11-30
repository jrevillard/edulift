import { describe, it, expect } from 'vitest'
import { parseSearchParams } from '../mobileRedirection'

// Mock URLSearchParams
const mockSearchParams = (params: Record<string, string>) => {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      searchParams.append(key, value)
    }
  })
  return searchParams
}

describe('mobileRedirection Utils', () => {
  describe('parseSearchParams', () => {
    it('should parse simple parameters correctly', () => {
      const searchParams = mockSearchParams({
        token: 'abc123',
        code: 'xyz789'
      })

      const result = parseSearchParams(searchParams)

      expect(result).toEqual({
        token: 'abc123',
        code: 'xyz789'
      })
    })

    it('should handle parameters with special characters', () => {
      const searchParams = mockSearchParams({
        message: 'hello world',
        encoded: '%E2%9C%A9',
        complex: 'param with spaces & symbols'
      })

      const result = parseSearchParams(searchParams)

      expect(result).toEqual({
        message: 'hello world',
        encoded: '%E2%9C%A9', // URLSearchParams keeps it encoded
        complex: 'param with spaces & symbols'
      })
    })

    it('should return empty object for no parameters', () => {
      const searchParams = new URLSearchParams()
      const result = parseSearchParams(searchParams)

      expect(result).toEqual({})
    })

    it('should handle duplicate keys', () => {
      const mockSearchParams = new URLSearchParams()
      mockSearchParams.set('key1', 'value1')
      mockSearchParams.set('key1', 'value2') // This should override the previous value
      mockSearchParams.set('key2', 'value3')

      const result = parseSearchParams(mockSearchParams)

      expect(result).toEqual({
        key1: 'value2',
        key2: 'value3'
      })
    })
  })
})