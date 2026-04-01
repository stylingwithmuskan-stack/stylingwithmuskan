import { useState, useEffect } from 'react';

// Global flags to prevent duplicate script loads
let isGoogleMapsLoading = false;
let isGoogleMapsLoaded = false;
let loadPromise = null;

/**
 * Custom hook for loading Google Maps API with caching and error handling
 * 
 * Features:
 * - Lazy loading (only loads when hook is used)
 * - Global caching (uses window.google persistence)
 * - Prevents duplicate script loads
 * - Retry logic with exponential backoff (max 3 retries)
 * - Error handling for script load failures
 * 
 * @param {string} apiKey - Google Maps API key
 * @returns {{isLoaded: boolean, loadError: Error|null, google: object|null}}
 */
const useGoogleMaps = (apiKey) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [google, setGoogle] = useState(null);

  useEffect(() => {
    // Skip if no API key provided
    if (!apiKey) {
      setLoadError(new Error('Google Maps API key not provided'));
      return;
    }

    // If already loaded, use cached version
    if (window.google?.maps) {
      isGoogleMapsLoaded = true;
      setGoogle(window.google);
      setIsLoaded(true);
      return;
    }

    // If currently loading, wait for existing promise
    if (isGoogleMapsLoading && loadPromise) {
      loadPromise
        .then((googleObj) => {
          setGoogle(googleObj);
          setIsLoaded(true);
        })
        .catch((error) => {
          setLoadError(error);
        });
      return;
    }

    // Start loading the script
    isGoogleMapsLoading = true;
    loadPromise = loadGoogleMapsScript(apiKey);

    loadPromise
      .then((googleObj) => {
        isGoogleMapsLoaded = true;
        isGoogleMapsLoading = false;
        setGoogle(googleObj);
        setIsLoaded(true);
      })
      .catch((error) => {
        isGoogleMapsLoading = false;
        setLoadError(error);
      });
  }, [apiKey]);

  return { isLoaded, loadError, google };
};

/**
 * Load Google Maps script with retry logic and exponential backoff
 * 
 * @param {string} apiKey - Google Maps API key
 * @param {number} retryCount - Current retry attempt (default: 0)
 * @param {number} maxRetries - Maximum number of retries (default: 3)
 * @returns {Promise<object>} - Resolves with window.google object
 */
const loadGoogleMapsScript = (apiKey, retryCount = 0, maxRetries = 3) => {
  return new Promise((resolve, reject) => {
    // Check if already loaded (race condition protection)
    if (window.google?.maps) {
      resolve(window.google);
      return;
    }

    // Check if script already exists in DOM
    const existingScript = document.querySelector(
      'script[src*="maps.googleapis.com/maps/api/js"]'
    );

    if (existingScript) {
      // Wait for existing script to load
      existingScript.addEventListener('load', () => {
        if (window.google?.maps) {
          resolve(window.google);
        } else {
          reject(new Error('Google Maps script loaded but google.maps not available'));
        }
      });
      existingScript.addEventListener('error', () => {
        reject(new Error('Failed to load Google Maps script'));
      });
      return;
    }

    // Create new script element
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=drawing`;
    script.async = true;
    script.defer = true;

    // Success handler
    script.onload = () => {
      if (window.google?.maps) {
        resolve(window.google);
      } else {
        reject(new Error('Google Maps script loaded but google.maps not available'));
      }
    };

    // Error handler with retry logic
    script.onerror = (error) => {
      // Remove failed script from DOM
      if (script.parentNode) {
        document.head.removeChild(script);
      }

      if (retryCount < maxRetries) {
        // Calculate exponential backoff delay: 1s, 2s, 4s
        const delay = Math.pow(2, retryCount) * 1000;
        
        console.warn(
          `Failed to load Google Maps (attempt ${retryCount + 1}/${maxRetries + 1}). ` +
          `Retrying in ${delay}ms...`
        );

        // Retry after delay
        setTimeout(() => {
          loadGoogleMapsScript(apiKey, retryCount + 1, maxRetries)
            .then(resolve)
            .catch(reject);
        }, delay);
      } else {
        reject(
          new Error(
            `Failed to load Google Maps after ${maxRetries + 1} attempts. ` +
            'Please check your API key and network connection.'
          )
        );
      }
    };

    // Append script to document head
    document.head.appendChild(script);
  });
};

export default useGoogleMaps;
