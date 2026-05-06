/**
 * Frontend Polygon Validation Utilities
 * Client-side validation for zone polygons (matches backend logic)
 */

/**
 * Validate polygon from Google Maps markers
 * @param {Array} markers - Array of Google Maps Marker objects
 * @returns {Object} - Validation result
 */
export function validatePolygonClient(markers, existingZones = [], currentZoneId = null) {
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
    
    const filteredZones = currentZoneId 
        ? (existingZones || []).filter(z => z._id !== currentZoneId)
        : (existingZones || []);
        
    return validatePolygonCoordinates(coordinates, filteredZones);
}

/**
 * Validate polygon from coordinates
 * @param {Array} coordinates - Array of {lat, lng} objects
 * @param {Array} existingZones - Array of existing zones to check overlap against
 * @returns {Object} - Validation result
 */
export function validatePolygonCoordinates(coordinates, existingZones = []) {
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
    
    // 6. Check for overlap with existing zones
    if (existingZones && existingZones.length > 0) {
        for (const zone of existingZones) {
            if (!zone || !Array.isArray(zone.coordinates) || zone.coordinates.length < 3) continue;
            
            const existingCoords = zone.coordinates.map(p => ({
                lat: Number(p.lat),
                lng: Number(p.lng)
            }));
            
            if (doPolygonsOverlap(coordinates, existingCoords)) {
                errors.push(`Zone overlaps with existing zone: ${zone.name}`);
                break;
            }
        }
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

/**
 * Point in polygon (Ray casting)
 */
function isPointInPolygon(point, polygon) {
    let isInside = false;
    let i, j;
    for (i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        if (((polygon[i].lat > point.lat) !== (polygon[j].lat > point.lat)) &&
            (point.lng < (polygon[j].lng - polygon[i].lng) * (point.lat - polygon[i].lat) / (polygon[j].lat - polygon[i].lat) + polygon[i].lng)) {
            isInside = !isInside;
        }
    }
    return isInside;
}

/**
 * Check if two polygons overlap
 */
function doPolygonsOverlap(poly1, poly2) {
    // Check if any edges intersect
    for (let i = 0; i < poly1.length; i++) {
        const p1_start = poly1[i];
        const p1_end = poly1[(i + 1) % poly1.length];
        
        for (let j = 0; j < poly2.length; j++) {
            const p2_start = poly2[j];
            const p2_end = poly2[(j + 1) % poly2.length];
            
            if (linesIntersect(p1_start, p1_end, p2_start, p2_end)) {
                return true;
            }
        }
    }
    
    // Check if poly1 is inside poly2 (just check one point)
    if (poly1.length > 0 && isPointInPolygon(poly1[0], poly2)) return true;
    
    // Check if poly2 is inside poly1 (just check one point)
    if (poly2.length > 0 && isPointInPolygon(poly2[0], poly1)) return true;
    
    return false;
}
