/**
 * IP Address Extraction Utility
 *
 * Provides reliable client IP address extraction from HTTP request headers.
 * Checks multiple headers in order of preference to support various deployment scenarios.
 *
 * Header Priority Order:
 * 1. x-forwarded-for - Standard proxy header (can contain multiple IPs, take the first)
 * 2. x-real-ip - Nginx and other reverse proxies
 * 3. cf-connecting-ip - Cloudflare
 * 4. x-client-ip - Some CDNs and load balancers
 * 5. 'unknown' - Fallback if no IP header is found
 */

import { Context } from 'hono';

/**
 * Extract client IP address from request headers.
 *
 * This function checks multiple headers in order of preference:
 * - x-forwarded-for: Standard proxy header (can contain multiple IPs, take the first)
 * - x-real-ip: Nginx and other reverse proxies
 * - cf-connecting-ip: Cloudflare
 * - x-client-ip: Some CDNs and load balancers
 *
 * If x-forwarded-for contains multiple IPs (comma-separated), only the first
 * IP is used, as it represents the original client IP.
 *
 * @param c - Hono Context object
 * @returns Client IP address as string, or 'unknown' if not found
 */
export const getClientIP = (c: Context): string => {
  return (
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('x-real-ip') ||
    c.req.header('cf-connecting-ip') ||
    c.req.header('x-client-ip') ||
    'unknown'
  );
};
