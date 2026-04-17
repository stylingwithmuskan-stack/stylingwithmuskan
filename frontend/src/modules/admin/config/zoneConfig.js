/**
 * Zone Configuration
 * Centralized configuration for zone management
 */

export const ZONE_CONFIG = {
    // Point constraints
    MIN_POINTS: 3,           // Minimum points for valid polygon
    MAX_POINTS: 8,           // Maximum points allowed (changed from 5 to 8)
    DEFAULT_POINTS: 8,       // Default for new zones
    
    // Area constraints
    MIN_AREA_SQM: 100000,    // Minimum zone area (100k sq meters = 0.1 km²)
    
    // Validation settings
    VALIDATION_ENABLED: true,
    ALLOW_SELF_INTERSECTION: false,
    SHOW_REAL_TIME_VALIDATION: true,
    
    // Visual settings
    MARKER_COLORS: {
        DEFAULT: '#FF0000',
        HOVER: '#FF4444',
        INVALID: '#FF6B6B',
        VALID: '#00FF00'
    },
    
    POLYGON_COLORS: {
        VALID: {
            stroke: '#00FF00',
            fill: '#00FF00'
        },
        INVALID: {
            stroke: '#FF0000',
            fill: '#FF0000'
        },
        DEFAULT: {
            stroke: '#FF0000',
            fill: '#FF0000'
        }
    },
    
    // UI Text
    UI_TEXT: {
        PLACE_POINTS: (min, max) => `Click to place ${min}-${max} points`,
        POINT_COUNTER: (current, max, isReady) => 
            `Point ${current} of ${max}${isReady ? ' (Ready)' : ''}`,
        MIN_POINTS_ERROR: (min) => `Please place at least ${min} points on the map`,
        MAX_POINTS_ERROR: (max) => `Maximum ${max} points allowed`,
        VALIDATION_VALID: 'Valid Zone',
        VALIDATION_INVALID: 'Invalid Shape'
    }
};

export default ZONE_CONFIG;
