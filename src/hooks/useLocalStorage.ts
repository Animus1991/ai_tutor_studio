import { useState, useEffect } from 'react';
import localforage from 'localforage';

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    localforage.getItem<string>(key).then((item) => {
      if (mounted && item !== null) {
        try {
          setStoredValue(JSON.parse(item));
        } catch (e) {
          console.warn(`Error parsing indexeddb key "${key}":`, e);
        }
      }
      if (mounted) setIsLoaded(true);
    }).catch(error => {
      console.warn(`Error reading indexeddb key "${key}":`, error);
      if (mounted) setIsLoaded(true);
    });
    return () => { mounted = false; };
  }, [key]);

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      if (typeof window !== "undefined") {
        localforage.setItem(key, JSON.stringify(valueToStore)).catch(error => {
          console.warn(`Error setting indexeddb key "${key}":`, error);
        });
      }
    } catch (error) {
      console.warn(`Error setting state key "${key}":`, error);
    }
  };

  return [storedValue, setValue, isLoaded] as const;
}
