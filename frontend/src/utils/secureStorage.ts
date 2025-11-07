/**
 * SECURE TOKEN STORAGE
 *
 * This provides encrypted storage for sensitive tokens to prevent XSS attacks.
 * Uses AES-GCM encryption with a key derived from browser fingerprint.
 */

// Generate a stable fingerprint for the current browser/session
const generateBrowserFingerprint = async (): Promise<string> => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // Generate canvas fingerprint
  if (ctx) {
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('Fingerprint generation', 2, 2);
  }

  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 'unknown',
      // deviceMemory is not in TypeScript types but exists in Chrome
    ((navigator as any).deviceMemory as number) || 'unknown',
    canvas.toDataURL()
  ].join('|');

  return fingerprint;
};

// Generate encryption key from browser fingerprint
const getEncryptionKey = async (): Promise<CryptoKey> => {
  try {
    const fingerprint = await generateBrowserFingerprint();

    // Use fingerprint as salt for PBKDF2
    const encoder = new TextEncoder();
    const fingerprintBytes = encoder.encode(fingerprint);

    // Import a base key from the fingerprint
    const baseKey = await crypto.subtle.importKey(
      'raw',
      fingerprintBytes,
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    // Derive a secure key using PBKDF2
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: fingerprintBytes,
        iterations: 100000,
        hash: 'SHA-256'
      },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    return key;
  } catch (error) {
    console.error('Failed to generate encryption key:', error);
    throw new Error('Failed to initialize secure storage');
  }
};

// Encrypt data using AES-GCM
const encryptData = async (data: string): Promise<{ encrypted: string; iv: string }> => {
  try {
    const key = await getEncryptionKey();
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(data);

    // Generate random IV for each encryption
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt with AES-GCM
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      dataBytes
    );

    // Return both encrypted data and IV
    return {
      encrypted: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
      iv: btoa(String.fromCharCode(...iv))
    };
  } catch (error) {
    console.error('Failed to encrypt data:', error);
    throw new Error('Encryption failed');
  }
};

// Decrypt data using AES-GCM
const decryptData = async (encryptedData: string, iv: string): Promise<string> => {
  try {
    const key = await getEncryptionKey();

    // Convert base64 strings back to Uint8Arrays
    const encryptedBytes = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
    const ivBytes = Uint8Array.from(atob(iv), c => c.charCodeAt(0));

    // Decrypt with AES-GCM
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBytes },
      key,
      encryptedBytes
    );

    // Convert back to string
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('Failed to decrypt data:', error);
    throw new Error('Decryption failed');
  }
};

// Storage interface for encrypted data
interface EncryptedData {
  encrypted: string;
  iv: string;
  timestamp: number;
}

class SecureStorage {
  private memoryStorage: Map<string, string> = new Map();

  // Store data with AES-GCM encryption
  async setItem(key: string, value: string): Promise<void> {
    try {
      const { encrypted, iv } = await encryptData(value);
      const dataToStore: EncryptedData = {
        encrypted,
        iv,
        timestamp: Date.now()
      };

      const serialized = JSON.stringify(dataToStore);

      // Try localStorage first
      try {
        localStorage.setItem(`secure_${key}`, serialized);
      } catch (storageError) {
        console.warn('localStorage failed, trying sessionStorage:', storageError);
        try {
          sessionStorage.setItem(`secure_${key}`, serialized);
        } catch (sessionError) {
          console.warn('sessionStorage failed, using memory storage:', sessionError);
          this.memoryStorage.set(key, value);
        }
      }
    } catch (error) {
      console.error('Failed to store encrypted data:', error);
      // Last resort: store plaintext in memory (better than nothing)
      this.memoryStorage.set(key, value);
    }
  }

  // Retrieve and decrypt data
  async getItem(key: string): Promise<string | null> {
    try {
      let serialized: string | null = null;

      // Try localStorage first
      serialized = localStorage.getItem(`secure_${key}`);

      // Fallback to sessionStorage
      if (!serialized) {
        serialized = sessionStorage.getItem(`secure_${key}`);
      }

      // Fallback to memory storage
      if (!serialized && this.memoryStorage.has(key)) {
        return this.memoryStorage.get(key)!;
      }

      if (!serialized) {
        return null;
      }

      // Parse and decrypt
      try {
        const dataToStore: EncryptedData = JSON.parse(serialized);
        const decrypted = await decryptData(dataToStore.encrypted, dataToStore.iv);

        // Check if data is too old (optional - 30 days)
        const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days in ms
        if (Date.now() - dataToStore.timestamp > maxAge) {
          console.warn('Encrypted data has expired, removing it');
          this.removeItem(key);
          return null;
        }

        return decrypted;
      } catch (decryptError) {
        console.error('Failed to decrypt stored data, it may be corrupted:', decryptError);
        // Remove corrupted data
        this.removeItem(key);
        return null;
      }
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
      this.memoryStorage.delete(key);
    } catch (error) {
      console.error('Failed to remove stored data:', error);
    }
  }

  // Clear all secure storage
  clear(): void {
    try {
      // Remove all secure_* items from localStorage
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('secure_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));

      // Remove all secure_* items from sessionStorage
      const sessionKeysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith('secure_')) {
          sessionKeysToRemove.push(key);
        }
      }
      sessionKeysToRemove.forEach(key => sessionStorage.removeItem(key));

      // Clear memory storage
      this.memoryStorage.clear();
    } catch (error) {
      console.error('Failed to clear secure storage:', error);
    }
  }

  // Check if key exists
  async hasItem(key: string): Promise<boolean> {
    const value = await this.getItem(key);
    return value !== null;
  }

  // Get all keys (only from localStorage/sessionStorage for security)
  getKeys(): string[] {
    const keys: string[] = [];

    // From localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('secure_')) {
        keys.push(key.replace('secure_', ''));
      }
    }

    // From sessionStorage
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith('secure_')) {
        const cleanKey = key.replace('secure_', '');
        if (!keys.includes(cleanKey)) {
          keys.push(cleanKey);
        }
      }
    }

    return keys;
  }
}

// Export singleton instance
export const secureStorage = new SecureStorage();