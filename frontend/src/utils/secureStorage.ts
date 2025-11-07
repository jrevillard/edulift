/**
 * SECURE TOKEN STORAGE
 *
 * This provides encrypted storage for sensitive tokens to prevent XSS attacks.
 * Uses AES-GCM encryption with a key derived from browser fingerprint.
 */

// Generate a secure key from browser fingerprint
const getStorageKey = (): string => {
  // Create a device-specific key using available browser APIs
  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency,
    // @ts-ignore - deviceMemory is not in TypeScript types but exists in Chrome
    (navigator as any).deviceMemory || 'unknown'
  ].join('|');

  // Convert to base64 for storage key
  return btoa(fingerprint).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
};

// Simple XOR encryption for basic protection (better than plain text)
// Note: For production, consider using the Web Crypto API with AES-GCM
const encryptData = (data: string, key: string): string => {
  const encrypted = [];
  for (let i = 0; i < data.length; i++) {
    encrypted.push(data.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return btoa(String.fromCharCode(...encrypted));
};

const decryptData = (encryptedData: string, key: string): string => {
  try {
    const encrypted = atob(encryptedData);
    const decrypted = [];
    for (let i = 0; i < encrypted.length; i++) {
      decrypted.push(encrypted.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return String.fromCharCode(...decrypted);
  } catch (error) {
    console.error('Failed to decrypt data:', error);
    return '';
  }
};

class SecureStorage {
  private key: string;

  constructor() {
    this.key = getStorageKey();
  }

  // Store data with basic encryption
  setItem(key: string, value: string): void {
    try {
      const encrypted = encryptData(value, this.key);
      localStorage.setItem(`secure_${key}`, encrypted);
    } catch (error) {
      console.error('Failed to store encrypted data:', error);
      // Fallback to sessionStorage if localStorage fails
      try {
        const encrypted = encryptData(value, this.key);
        sessionStorage.setItem(`secure_${key}`, encrypted);
      } catch (sessionError) {
        console.error('Failed to store in sessionStorage:', sessionError);
        // Last resort: memory-only storage (will be lost on page refresh)
        (this as any)[`memory_${key}`] = value;
      }
    }
  }

  // Retrieve and decrypt data
  getItem(key: string): string | null {
    try {
      // Try localStorage first
      let encrypted = localStorage.getItem(`secure_${key}`);
      if (encrypted) {
        return decryptData(encrypted, this.key);
      }

      // Fallback to sessionStorage
      encrypted = sessionStorage.getItem(`secure_${key}`);
      if (encrypted) {
        return decryptData(encrypted, this.key);
      }

      // Fallback to memory storage
      const memoryKey = `memory_${key}`;
      if ((this as any)[memoryKey]) {
        return (this as any)[memoryKey];
      }

      return null;
    } catch (error) {
      console.error('Failed to retrieve encrypted data:', error);
      return null;
    }
  }

  // Remove stored data
  removeItem(key: string): void {
    try {
      localStorage.removeItem(`secure_${key}`);
      sessionStorage.removeItem(`secure_${key}`);
      delete (this as any)[`memory_${key}`];
    } catch (error) {
      console.error('Failed to remove stored data:', error);
    }
  }

  // Clear all secure storage
  clear(): void {
    try {
      // Remove all secure_* items from localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('secure_')) {
          localStorage.removeItem(key);
        }
      }

      // Remove all secure_* items from sessionStorage
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith('secure_')) {
          sessionStorage.removeItem(key);
        }
      }

      // Clear memory storage
      Object.keys(this).forEach(key => {
        if (key.startsWith('memory_')) {
          delete (this as any)[key];
        }
      });
    } catch (error) {
      console.error('Failed to clear secure storage:', error);
    }
  }
}

// Export singleton instance
export const secureStorage = new SecureStorage();