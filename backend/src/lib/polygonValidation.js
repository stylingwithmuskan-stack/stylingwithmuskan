/**
 * Polygon Validation Utilities
 * Validates polygon geometry for zone boundaries
 */

/**
 * Validate polygon geometry
 * @param {Array} coordinates - Array of {lat, lng} objects
 * @returns {Object} - Validation result with errors and metrics
 */
export function validatePolygon(coordinates) {
  const errors = [];
  
  // 1. Check minimum points
  if (!Array.isArray(coordinates) || coordinates.length < 3) {
    errors.push('Polygon must have at least 3 points');
    return { isValid: false, errors, area: 0, perimeter: 0 };
  }
  
  // 2. Validate coordinate format
  for (let i = 0; i < coordinates.length; i++) {
    if (!isValidCoordinate(coordinates[i])) {
      errors.push(`Invalid coordinate format at point ${i + 1}`);
      return { isValid: false, errors, area: 0, perimeter: 0 };
    }
  }
  
  // 3. Check for duplicate consecutive points
  for (let i = 0; i < coordinates.length; i++) {
    const current = coordinates[i];
    const next = coordinates[(i + 1) % coordinates.length];
    if (Math.abs(current.lat - next.lat) < 0.000001 && 
        Math.abs(current.lng - next.lng) < 0.000001) {
      errors.push(`Duplicate consecutive points at position ${i + 1}`);
    }
  }
  
  // 4. Check for self-intersection
  if (hasSelfIntersection(coordinates)) {
    errors.push('Polygon lines cannot cross each other');
  }
  
  // 5. Calculate area
  const area = calculatePolygonArea(coordinates);
  if (area < 100000) { // 100k sq meters = 0.1 km²
    errors.push(`Zone area is too small (${(area / 1000000).toFixed(2)} km²). Minimum required: 0.1 km²`);
  }
  
  // 6. Check if points form valid polygon (not collinear)
  if (!isValidPolygonShape(coordinates)) {
    errors.push('Points do not form a valid polygon shape (all points are collinear)');
  }
  
  // 7. Calculate perimeter
  const perimeter = calculatePerimeter(coordinates);
  
  return {
    isValid: errors.length === 0,
    errors,
    area: Math.round(area),
    areaKm: parseFloat((area / 1000000).toFixed(2)),
    perimeter: Math.round(perimeter),
    perimeterKm: parseFloat((perimeter / 1000).toFixed(2)),
    pointCount: coordinates.length
  };
}

/**
 * Validate single coordinate
 */
function isValidCoordinate(coord) {
  if (!coord || typeof coord !== 'object') return false;
  
  const lat = Number(coord.lat);
  const lng = Number(coord.lng);
  
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  
  return true;
}

/**
 * Check if two line segments intersect
 */
function linesIntersect(p1, p2, p3, p4) {
  const det = (p2.lng - p1.lng) * (p4.lat - p3.lat) - 
              (p4.lng - p3.lng) * (p2.lat - p1.lat);
  
  if (Math.abs(det) < 1e-10) return false; // Parallel or collinear
  
  const lambda = ((p4.lat - p3.lat) * (p4.lng - p1.lng) + 
                  (p3.lng - p4.lng) * (p4.lat - p1.lat)) / det;
  const gamma = ((p1.lat - p2.lat) * (p4.lng - p1.lng) + 
                 (p2.lng - p1.lng) * (p4.lat - p1.lat)) / det;
  
  return (0 < lambda && lambda < 1) && (0 < gamma && gamma < 1);
}

/**
 * Check for self-intersection in polygon
 */
function hasSelfIntersection(coordinates) {
  const n = coordinates.length;
  
  for (let i = 0; i < n; i++) {
    const line1Start = coordinates[i];
    const line1End = coordinates[(i + 1) % n];
    
    // Check against all non-adjacent edges
    for (let j = i + 2; j < n; j++) {
      // Skip the edge that shares a vertex with current edge
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
 * Calculate polygon area using Shoelace formula
 * Returns area in square meters (approximate)
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
  // At equator: 1 degree latitude ≈ 111 km, 1 degree longitude ≈ 111 km
  // This is approximate and varies with latitude
  const metersPerDegree = 111000;
  return area * metersPerDegree * metersPerDegree;
}

/**
 * Calculate polygon perimeter
 * Returns perimeter in meters
 */
function calculatePerimeter(coordinates) {
  let perimeter = 0;
  const n = coordinates.length;
  
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const dist = calculateDistance(coordinates[i], coordinates[j]);
    perimeter += dist;
  }
  
  return perimeter;
}

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in meters
 */
function calculateDistance(p1, p2) {
  const R = 6371000; // Earth radius in meters
  const lat1 = p1.lat * Math.PI / 180;
  const lat2 = p2.lat * Math.PI / 180;
  const deltaLat = (p2.lat - p1.lat) * Math.PI / 180;
  const deltaLng = (p2.lng - p1.lng) * Math.PI / 180;
  
  const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

/**
 * Check if polygon is valid (not degenerate/collinear)
 */
function isValidPolygonShape(coordinates) {
  if (coordinates.length < 3) return false;
  
  // Check if all points are collinear by calculating cross products
  // If all cross products are near zero, points are collinear
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
