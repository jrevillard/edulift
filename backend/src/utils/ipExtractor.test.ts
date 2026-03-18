/**
 * Unit tests for IP address extraction utility
 */

import { describe, it, expect } from '@jest/globals';
import { getClientIP } from './ipExtractor';
import { Context } from 'hono';

// Helper to create a mock Hono context
const createMockContext = (headers: Record<string, string>): Context => {
  return {
    req: {
      header: (name: string) => {
        // Try exact match first, then case-insensitive fallback
        return headers[name] || headers[Object.keys(headers).find(
          key => key.toLowerCase() === name.toLowerCase()
        ) || ''];
      },
    },
  } as unknown as Context;
};

describe('getClientIP', () => {
  describe('x-forwarded-for header (highest priority)', () => {
    it('should extract IP from x-forwarded-for with single IP', () => {
      const context = createMockContext({
        'x-forwarded-for': '192.168.1.100',
      });
      expect(getClientIP(context)).toBe('192.168.1.100');
    });

    it('should extract first IP from x-forwarded-for with multiple IPs', () => {
      const context = createMockContext({
        'x-forwarded-for': '192.168.1.100, 10.0.0.1, 172.16.0.1',
      });
      expect(getClientIP(context)).toBe('192.168.1.100');
    });

    it('should trim whitespace from x-forwarded-for IP', () => {
      const context = createMockContext({
        'x-forwarded-for': '  192.168.1.100  , 10.0.0.1',
      });
      expect(getClientIP(context)).toBe('192.168.1.100');
    });

    it('should prioritize x-forwarded-for over other headers', () => {
      const context = createMockContext({
        'x-forwarded-for': '192.168.1.100',
        'x-real-ip': '10.0.0.1',
        'cf-connecting-ip': '172.16.0.1',
      });
      expect(getClientIP(context)).toBe('192.168.1.100');
    });
  });

  describe('x-real-ip header (second priority)', () => {
    it('should extract IP from x-real-ip when x-forwarded-for is absent', () => {
      const context = createMockContext({
        'x-real-ip': '10.0.0.1',
      });
      expect(getClientIP(context)).toBe('10.0.0.1');
    });

    it('should prioritize x-real-ip over cf-connecting-ip and x-client-ip', () => {
      const context = createMockContext({
        'x-real-ip': '10.0.0.1',
        'cf-connecting-ip': '172.16.0.1',
        'x-client-ip': '192.168.1.100',
      });
      expect(getClientIP(context)).toBe('10.0.0.1');
    });
  });

  describe('cf-connecting-ip header (Cloudflare)', () => {
    it('should extract IP from cf-connecting-ip when higher priority headers are absent', () => {
      const context = createMockContext({
        'cf-connecting-ip': '172.16.0.1',
      });
      expect(getClientIP(context)).toBe('172.16.0.1');
    });

    it('should prioritize cf-connecting-ip over x-client-ip', () => {
      const context = createMockContext({
        'cf-connecting-ip': '172.16.0.1',
        'x-client-ip': '192.168.1.100',
      });
      expect(getClientIP(context)).toBe('172.16.0.1');
    });
  });

  describe('x-client-ip header (fourth priority)', () => {
    it('should extract IP from x-client-ip when higher priority headers are absent', () => {
      const context = createMockContext({
        'x-client-ip': '192.168.1.100',
      });
      expect(getClientIP(context)).toBe('192.168.1.100');
    });
  });

  describe('fallback to unknown', () => {
    it('should return "unknown" when no IP headers are present', () => {
      const context = createMockContext({});
      expect(getClientIP(context)).toBe('unknown');
    });

    it('should return "unknown" when headers are present but empty', () => {
      const context = createMockContext({
        'x-forwarded-for': '',
        'x-real-ip': '',
      });
      expect(getClientIP(context)).toBe('unknown');
    });
  });

  describe('edge cases', () => {
    it('should handle IPv6 addresses', () => {
      const context = createMockContext({
        'x-forwarded-for': '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
      });
      expect(getClientIP(context)).toBe('2001:0db8:85a3:0000:0000:8a2e:0370:7334');
    });

    it('should handle localhost IP', () => {
      const context = createMockContext({
        'x-forwarded-for': '127.0.0.1',
      });
      expect(getClientIP(context)).toBe('127.0.0.1');
    });

    it('should handle case-insensitive header names', () => {
      const context = createMockContext({
        'X-Forwarded-For': '192.168.1.100',
        'X-Real-IP': '10.0.0.1',
      });
      expect(getClientIP(context)).toBe('192.168.1.100');
    });
  });
});
