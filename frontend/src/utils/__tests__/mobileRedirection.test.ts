import { describe, it, expect } from 'vitest'
import { parseSearchParams, isMobileSupportedRoute, getMobilePath, buildCustomSchemeUrl } from '../mobileRedirection'

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
  describe('buildCustomSchemeUrl', () => {
    it('should use default edulift scheme when config is not set', () => {
      const url = buildCustomSchemeUrl('/auth/verify', { token: 'abc123' })
      expect(url).toBe('edulift:///auth/verify?token=abc123')
    })

    it('should build URL with multiple parameters', () => {
      const url = buildCustomSchemeUrl('/families/join', {
        code: 'xyz789',
        redirect: '/dashboard'
      })
      expect(url).toBe('edulift:///families/join?code=xyz789&redirect=%2Fdashboard')
    })

    it('should build URL without parameters', () => {
      const url = buildCustomSchemeUrl('/dashboard')
      expect(url).toBe('edulift:///dashboard')
    })

    it('should sanitize parameters by removing dangerous characters', () => {
      const url = buildCustomSchemeUrl('/auth/verify', {
        token: '<script>alert("xss")</script>',
        safe: 'value123'
      })
      // The regex /[<>"'&]/g removes <, >, ", ', & but keeps parentheses
      expect(url).toBe('edulift:///auth/verify?token=scriptalert(xss)%2Fscript&safe=value123')
    })

    it('should handle supported path types', () => {
      expect(buildCustomSchemeUrl('/auth/verify')).toMatch(/^edulift:\/\/\/auth\/verify/)
      expect(buildCustomSchemeUrl('/families/join')).toMatch(/^edulift:\/\/\/families\/join/)
      expect(buildCustomSchemeUrl('/groups/join')).toMatch(/^edulift:\/\/\/groups\/join/)
      expect(buildCustomSchemeUrl('/dashboard')).toMatch(/^edulift:\/\/\/dashboard/)
    })

    it('should URL encode parameter values', () => {
      const url = buildCustomSchemeUrl('/auth/verify', {
        token: 'abc def 123',
        email: 'user@example.com'
      })
      // encodeURIComponent uses %20 for spaces, not +
      expect(url).toBe('edulift:///auth/verify?token=abc%20def%20123&email=user%40example.com')
    })
  })

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

  describe('isMobileSupportedRoute', () => {
    it('should return true for supported routes', () => {
      expect(isMobileSupportedRoute('/auth/verify')).toBe(true)
      expect(isMobileSupportedRoute('/families/join')).toBe(true)
      expect(isMobileSupportedRoute('/groups/join')).toBe(true)
      expect(isMobileSupportedRoute('/dashboard')).toBe(true)
    })

    it('should return false for unsupported routes', () => {
      expect(isMobileSupportedRoute('/unsupported')).toBe(false)
      expect(isMobileSupportedRoute('/auth/login')).toBe(false)
      expect(isMobileSupportedRoute('/')).toBe(false)
    })
  })

  describe('getMobilePath', () => {
    it('should return the corresponding mobile path for supported routes', () => {
      expect(getMobilePath('/auth/verify')).toBe('/auth/verify')
      expect(getMobilePath('/families/join')).toBe('/families/join')
      expect(getMobilePath('/groups/join')).toBe('/groups/join')
      expect(getMobilePath('/dashboard')).toBe('/dashboard')
    })

    it('should return null for unsupported routes', () => {
      expect(getMobilePath('/unsupported')).toBe(null)
      expect(getMobilePath('/auth/login')).toBe(null)
    })
  })
})