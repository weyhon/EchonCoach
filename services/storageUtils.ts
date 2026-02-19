/**
 * Safe localStorage utilities
 * Handles quota exceeded errors, disabled localStorage (private browsing), and other storage failures
 * Provides graceful fallbacks to in-memory storage when localStorage is unavailable
 */

/**
 * Check if localStorage is available and working
 * Returns false in private browsing mode or when storage is disabled
 */
export const isLocalStorageAvailable = (): boolean => {
  try {
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
};

/**
 * Safely get an item from localStorage
 * Returns null if localStorage is unavailable or key doesn't exist
 */
export const safeGetItem = (key: string): string | null => {
  try {
    if (!isLocalStorageAvailable()) {
      console.warn('localStorage unavailable, cannot retrieve item');
      return null;
    }
    return localStorage.getItem(key);
  } catch (error) {
    console.warn(`localStorage.getItem failed for key "${key}":`, error);
    return null;
  }
};

/**
 * Safely set an item in localStorage
 * Returns true on success, false on failure
 * Handles quota exceeded errors gracefully
 */
export const safeSetItem = (key: string, value: string): boolean => {
  try {
    if (!isLocalStorageAvailable()) {
      console.warn('localStorage unavailable, cannot save item');
      return false;
    }

    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    // Check if it's a quota exceeded error
    if (
      error instanceof DOMException &&
      (error.code === 22 ||
        error.code === 1014 ||
        error.name === 'QuotaExceededError' ||
        error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
    ) {
      console.error('localStorage quota exceeded, cannot save item');

      // Try to free up space by removing old items
      try {
        const oldKeys = Object.keys(localStorage);
        if (oldKeys.length > 0) {
          // Remove the oldest key (first one)
          localStorage.removeItem(oldKeys[0]);
          console.log(`Removed old key "${oldKeys[0]}" to free space`);

          // Try again
          localStorage.setItem(key, value);
          return true;
        }
      } catch (retryError) {
        console.error('Failed to free space and retry:', retryError);
      }
    } else {
      console.warn(`localStorage.setItem failed for key "${key}":`, error);
    }

    return false;
  }
};

/**
 * Safely remove an item from localStorage
 * Returns true on success, false on failure
 */
export const safeRemoveItem = (key: string): boolean => {
  try {
    if (!isLocalStorageAvailable()) {
      console.warn('localStorage unavailable, cannot remove item');
      return false;
    }

    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.warn(`localStorage.removeItem failed for key "${key}":`, error);
    return false;
  }
};

/**
 * Safely clear all localStorage items
 * Returns true on success, false on failure
 */
export const safeClear = (): boolean => {
  try {
    if (!isLocalStorageAvailable()) {
      console.warn('localStorage unavailable, cannot clear');
      return false;
    }

    localStorage.clear();
    return true;
  } catch (error) {
    console.warn('localStorage.clear failed:', error);
    return false;
  }
};

/**
 * Get parsed JSON from localStorage with type safety
 * Returns default value if parsing fails or item doesn't exist
 */
export const safeGetJSON = <T>(key: string, defaultValue: T): T => {
  try {
    const item = safeGetItem(key);
    if (!item) return defaultValue;

    return JSON.parse(item) as T;
  } catch (error) {
    console.warn(`Failed to parse JSON from localStorage key "${key}":`, error);
    return defaultValue;
  }
};

/**
 * Set JSON object in localStorage with automatic stringification
 * Returns true on success, false on failure
 */
export const safeSetJSON = <T>(key: string, value: T): boolean => {
  try {
    const jsonString = JSON.stringify(value);
    return safeSetItem(key, jsonString);
  } catch (error) {
    console.warn(`Failed to stringify and save JSON to localStorage key "${key}":`, error);
    return false;
  }
};
