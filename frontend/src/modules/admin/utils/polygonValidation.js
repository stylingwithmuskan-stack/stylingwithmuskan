/**
 * Frontend Polygon Validation Utilities
 * Client-side validation for zone polygons (matches backend logic)
 */

/**
 * Validate polygon from Google Maps markers
 * @param {Array} markers - Array of Google Maps Marker objects
 * @returns {Object} - Validation result
 */
export function validatePolygonClient(markers) {
    if (!markers || markers.length === 0) {
        return {
            isValid: false,
            errors: ['No markers placed'],
            area: 0,
            areaKm: 0
        };
    }
    
    const coordinates = markers.map(m => {
        const pos = m.getPosition();
        return { lat: pos.lat(), lng: pos.lng() };
    });
    
    return validatePolygonCoordinates(coordinates);
}

/**
 * Validate polygon from coordinates
 * @param {Array} coordinates - Array of {lat, lng} objects
 * @returns {Object} - Validation result
 */
export function validatePolygonCoordinates(coordinates) {
    const errors = [];
    
    // 1. Check minimum points
    if (!Array.isArray(coordinates) || coordinates.length < 3) {
        errors.push('Polygon must have at least 3 points');
        return { isValid: false, errors, area: 0, areaKm: 0 };
    }
    
    // 2. Check for duplicate consecutive points
    for (let i = 0; i < coordinates.length; i++) {
        const current = coordinates[i];
        const next = coordinates[(i + 1) % coordinates.length];
        if (Math.abs(current.lat - next.lat) < 0.000001 && 
            Math.abs(current.lng - next.lng) < 0.000001) {
            errors.push(`Duplicate points at position ${i + 1}`);
        }
    }
    
    // 3. Check for self-intersection
    if (hasSelfIntersection(coordinates)) {
        errors.push('Polygon lines cannot cross each other');
    }
    
    // 4. Calculate area
    const area = calculatePolygonArea(coordinates);
    if (area < 100000) { // 100k sq meters
        errors.push(`Zone area too small (${(area / 1000000).toFixed(2)} km²). Min: 0.1 km²`);
    }
    
    // 5. Check if valid polygon shape
    if (!isValidPolygonShape(coordinates)) {
        errors.push('Points do not form a valid polygon');
    }
    
    return {
        isValid: errors.length === 0,
        errors,
        area: Math.round(area),
        areaKm: parseFloat((area / 1000000).toFixed(2)),
        pointCount: coordinates.length
    };
}

/**
 * Check if two line segments intersect
 */
function linesIntersect(p1, p2, p3, p4) {
    const det = (p2.lng - p1.lng) * (p4.lat - p3.lat) - 
                (p4.lng - p3.lng) * (p2.lat - p1.lat);
    
    if (Math.abs(det) < 1e-10) return false; // Parallel
    
    const lambda = ((p4.lat - p3.lat) * (p4.lng - p1.lng) + 
                    (p3.lng - p4.lng) * (p4.lat - p1.lat)) / det;
    const gamma = ((p1.lat - p2.lat) * (p4.lng - p1.lng) + 
                   (p2.lng - p1.lng) * (p4.lat - p1.lat)) / det;
    
    return (0 < lambda && lambda < 1) && (0 < gamma && gamma < 1);
}

/**
 * Check for self-intersection
 */
function hasSelfIntersection(coordinates) {
    const n = coordinates.length;
    
    for (let i = 0; i < n; i++) {
        const line1Start = coordinates[i];
        const line1End = coordinates[(i + 1) % n];
        
        for (let j = i + 2; j < n; j++) {
            if (j === (i + n - 1) % n || (i === 0 && j === n - 1)) continue;
            
            const line2Start = coordinates[j];
            const line2End = coordinates[(j + 1) % n];
            
            if (linesIntersect(line1Start, line1End, line2Start, line2End)) {
                return true;
            }
        }
    }
    
    return false;
}

/**
 * Calculate polygon area (Shoelace formula)
 */
function calculatePolygonArea(coordinates) {
    let area = 0;
    const n = coordinates.length;
    
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        area += coordinates[i].lng * coordinates[j].lat;
        area -= coordinates[j].lng * coordinates[i].lat;
    }
    
    area = Math.abs(area) / 2;
    
    // Convert to square meters (approximate)
    const metersPerDegree = 111000;
    return area * metersPerDegree * metersPerDegree;
}

/**
 * Check if polygon is valid (not collinear)
 */
function isValidPolygonShape(coordinates) {
    if (coordinates.length < 3) return false;
    
    let hasNonZeroCross = false;
    
    for (let i = 0; i < coordinates.length - 2; i++) {
        const p1 = coordinates[i];
        const p2 = coordinates[i + 1];
        const p3 = coordinates[i + 2];
        
        const crossProduct = 
            (p2.lng - p1.lng) * (p3.lat - p1.lat) - 
            (p3.lng - p1.lng) * (p2.lat - p1.lat);
        
        if (Math.abs(crossProduct) > 1e-8) {
            hasNonZeroCross = true;
            break;
        }
    }
    
    return hasNonZeroCross;
}
