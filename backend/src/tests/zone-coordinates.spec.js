import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { City, Zone } from '../models/CityZone.js';

describe('Zone Coordinate Validation', () => {
  let testCityId;

  beforeAll(async () => {
    // Create test city
    const city = await City.create({ name: 'Test City for Validation' });
    testCityId = city._id;
  });

  afterAll(async () => {
    // Clean up test city and zones
    await Zone.deleteMany({ city: testCityId });
    await City.deleteOne({ _id: testCityId });
  });

  beforeEach(async () => {
    await Zone.deleteMany({ city: testCityId });
  });

  it('should create zone without coordinates (backward compatibility)', async () => {
    const zone = await Zone.create({
      name: 'Zone Without Coords',
      city: testCityId
    });

    expect(zone.name).toBe('Zone Without Coords');
    expect(zone.coordinates).toBeNull();
  });

  it('should create zone with valid 5 coordinates', async () => {
    const validCoordinates = [
      { lat: 28.6139, lng: 77.2090 },
      { lat: 28.6140, lng: 77.2091 },
      { lat: 28.6141, lng: 77.2092 },
      { lat: 28.6142, lng: 77.2093 },
      { lat: 28.6143, lng: 77.2094 }
    ];

    const zone = await Zone.create({
      name: 'Zone With Coords',
      city: testCityId,
      coordinates: validCoordinates
    });

    expect(zone.coordinates).toHaveLength(5);
    expect(zone.coordinates[0].lat).toBe(28.6139);
    expect(zone.coordinates[0].lng).toBe(77.2090);
  });

  it('should reject coordinates with wrong array length', async () => {
    const invalidCoordinates = [
      { lat: 28.6139, lng: 77.2090 },
      { lat: 28.6140, lng: 77.2091 },
      { lat: 28.6141, lng: 77.2092 }
    ];

    await expect(
      Zone.create({
        name: 'Invalid Zone',
        city: testCityId,
        coordinates: invalidCoordinates
      })
    ).rejects.toThrow();
  });

  it('should reject coordinates with invalid latitude', async () => {
    const invalidCoordinates = [
      { lat: 91, lng: 77.2090 }, // Invalid lat > 90
      { lat: 28.6140, lng: 77.2091 },
      { lat: 28.6141, lng: 77.2092 },
      { lat: 28.6142, lng: 77.2093 },
      { lat: 28.6143, lng: 77.2094 }
    ];

    await expect(
      Zone.create({
        name: 'Invalid Zone',
        city: testCityId,
        coordinates: invalidCoordinates
      })
    ).rejects.toThrow();
  });

  it('should reject coordinates with invalid longitude', async () => {
    const invalidCoordinates = [
      { lat: 28.6139, lng: 181 }, // Invalid lng > 180
      { lat: 28.6140, lng: 77.2091 },
      { lat: 28.6141, lng: 77.2092 },
      { lat: 28.6142, lng: 77.2093 },
      { lat: 28.6143, lng: 77.2094 }
    ];

    await expect(
      Zone.create({
        name: 'Invalid Zone',
        city: testCityId,
        coordinates: invalidCoordinates
      })
    ).rejects.toThrow();
  });

  it('should update zone with coordinates', async () => {
    const zone = await Zone.create({
      name: 'Update Test Zone',
      city: testCityId
    });

    const newCoordinates = [
      { lat: 28.6139, lng: 77.2090 },
      { lat: 28.6140, lng: 77.2091 },
      { lat: 28.6141, lng: 77.2092 },
      { lat: 28.6142, lng: 77.2093 },
      { lat: 28.6143, lng: 77.2094 }
    ];

    const updated = await Zone.findByIdAndUpdate(
      zone._id,
      { coordinates: newCoordinates },
      { new: true, runValidators: true }
    );

    expect(updated.coordinates).toHaveLength(5);
    expect(updated.coordinates[0].lat).toBe(28.6139);
  });

  it('should allow clearing coordinates by setting to null', async () => {
    const zone = await Zone.create({
      name: 'Clear Test Zone',
      city: testCityId,
      coordinates: [
        { lat: 28.6139, lng: 77.2090 },
        { lat: 28.6140, lng: 77.2091 },
        { lat: 28.6141, lng: 77.2092 },
        { lat: 28.6142, lng: 77.2093 },
        { lat: 28.6143, lng: 77.2094 }
      ]
    });

    const updated = await Zone.findByIdAndUpdate(
      zone._id,
      { coordinates: null },
      { new: true }
    );

    expect(updated.coordinates).toBeNull();
  });
});

