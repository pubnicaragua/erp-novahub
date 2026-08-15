import { useState, useEffect } from 'react';
import { safeSetItem, safeRemoveItem } from '../services/safe-storage';

export function useLocalStorageState<T>(key: string, initialValue: T, expirationHours = 1) {
    // Initialize state
    const [state, setState] = useState<T>(() => {
        try {
            const item = window.localStorage.getItem(`nh-erp-${key}`);
            if (item) {
                const parsed = JSON.parse(item);
                const now = new Date().getTime();

                // If expired, or forced invalid structure
                if (parsed.expiry && now > parsed.expiry) {
                    safeRemoveItem(`nh-erp-${key}`);
                    return initialValue;
                }
                return parsed.value;
            }
        } catch (error) {
            console.warn(`Error reading localStorage key "nh-erp-${key}":`, error);
        }
        return initialValue;
    });

    // Update localStorage when state changes
    useEffect(() => {
        try {
            const now = new Date().getTime();
            const item = {
                value: state,
                expiry: now + expirationHours * 60 * 60 * 1000, // hours to milliseconds
            };
            safeSetItem(`nh-erp-${key}`, JSON.stringify(item));
        } catch (error) {
            console.warn(`Error setting localStorage key "nh-erp-${key}":`, error);
        }
    }, [key, state, expirationHours]);

    return [state, setState] as const;
}
