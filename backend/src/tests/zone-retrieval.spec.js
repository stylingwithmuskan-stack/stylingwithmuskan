import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { City, Zone } from '../models/CityZone.js';
import * as AdminController from '../modules/admin/controllers/admin.controller.js';

describe('Zone Retrieval with Coordinates', () => {
  let testCityId;

  beforeAll(async () => {
    // Create test city
    const city = await City.create({ name: 'Test City for Retrieval' });
    testCityId = city._id;
  });

  afterAll(async () => {
    // Clean up test city and zones
    await Zone.deleteMany({ city: testCityId });
    await City.deleteOne({ _id: testCityId });
  });

  beforeEach(async () => {
    // Clean up zones before each test
    await Zone.deleteMany({ city: testCityId });
  });

  describe('listZones function returns coordinates field', () => {
    it('should return coordinates for zones that have them', async () => {
      // Create zone with coordinates
      const validCoordinates = [
        { lat: 28.6139, lng: 77.2090 },
        { lat: 28.6140, lng: 77.2091 },
        { lat: 28.6141, lng: 77.2092 },
        { lat: 28.6142, lng: 77.2093 },
        { lat: 28.6143, lng: 77.2094 }
      ];

      await Zone.create({
        name: 'Zone With Coords',
        city: testCityId,
        coordinates: validCoordinates
      });

      // Mock request and response
      const req = {
        params: { cityId: testCityId.toString() }
      };
      const res = {
        json: function(data) {
          this.data = data;
          return this;
        }
      };

      await AdminController.listZones(req, res);

      expect(res.data.zones).toHaveLength(1);
      expect(res.data.zones[0].coordinates).toBeDefined();
      expect(res.data.zones[0].coordinates).toHaveLength(5);
      expect(res.data.zones[0].coordinates[0].lat).toBe(28.6139);
      expect(res.data.zones[0].coordinates[0].lng).toBe(77.2090);
    });

    it('should return null for zones without coordinates', async () => {
      // Create zone without coordinates
      await Zone.create({
        name: 'Zone Without Coords',
        city: testCityId
      });

      // Mock request and response
      const req = {
        params: { cityId: testCityId.toString() }
      };
      const res = {
        json: function(data) {
          this.data = data;
          return this;
        }
      };

      await AdminController.listZones(req, res);

      expect(res.data.zones).toHaveLength(1);
      expect(res.data.zones[0].coordinates).toBeNull();
    });

    it('should return mixed zones (with and without coordinates)', async () => {
      // Create zone with coordinates
      const validCoordinates = [
        { lat: 28.6139, lng: 77.2090 },
        { lat: 28.6140, lng: 77.2091 },
        { lat: 28.6141, lng: 77.2092 },
        { lat: 28.6142, lng: 77.2093 },
        { lat: 28.6143, lng: 77.2094 }
      ];

      await Zone.create({
        name: 'Zone With Coords',
        city: testCityId,
        coordinates: validCoordinates
      });

      // Create zone without coordinates
      await Zone.create({
        name: 'Zone Without Coords',
        city: testCityId
      });

      // Mock request and response
      const req = {
        params: { cityId: testCityId.toString() }
      };
      const res = {
        json: function(data) {
          this.data = data;
          return this;
        }
      };

      await AdminController.listZones(req, res);

      expect(res.data.zones).toHaveLength(2);
      
      // Find zones by name
      const zoneWithCoords = res.data.zones.find(z => z.name === 'Zone With Coords');
      const zoneWithoutCoords = res.data.zones.find(z => z.name === 'Zone Without Coords');

      expect(zoneWithCoords.coordinates).toBeDefined();
      expect(zoneWithCoords.coordinates).toHaveLength(5);
      expect(zoneWithoutCoords.coordinates).toBeNull();
    });
  });

  describe('Provider registration API includes coordinates', () => {
    it('should include coordinates field when zones are retrieved for provider registration', async () => {
      // Create zones with and without coordinates
      const validCoordinates = [
        { lat: 28.6139, lng: 77.2090 },
        { lat: 28.6140, lng: 77.2091 },
        { lat: 28.6141, lng: 77.2092 },
        { lat: 28.6142, lng: 77.2093 },
        { lat: 28.6143, lng: 77.2094 }
      ];

      await Zone.create({
        name: 'Provider Zone With Coords',
        city: testCityId,
        coordinates: validCoordinates
      });

      await Zone.create({
        name: 'Provider Zone Without Coords',
        city: testCityId
      });

      // Simulate provider registration flow - fetch zones
      const zones = await Zone.find({ city: testCityId }).lean();

      expect(zones).toHaveLength(2);
      
      // Verify coordinates field is present
      const zoneWithCoords = zones.find(z => z.name === 'Provider Zone With Coords');
      const zoneWithoutCoords = zones.find(z => z.name === 'Provider Zone Without Coords');

      expect(zoneWithCoords.coordinates).toBeDefined();
      expect(zoneWithCoords.coordinates).toHaveLength(5);
      expect(zoneWithoutCoords.coordinates).toBeNull();
    });
  });

  describe('Vendor registration API includes coordinates', () => {
    it('should include coordinates field when zones are retrieved for vendor registration', async () => {
      // Create zones with and without coordinates
      const validCoordinates = [
        { lat: 28.6139, lng: 77.2090 },
        { lat: 28.6140, lng: 77.2091 },
        { lat: 28.6141, lng: 77.2092 },
        { lat: 28.6142, lng: 77.2093 },
        { lat: 28.6143, lng: 77.2094 }
      ];

      await Zone.create({
        name: 'Vendor Zone With Coords',
        city: testCityId,
        coordinates: validCoordinates
      });

      await Zone.create({
        name: 'Vendor Zone Without Coords',
        city: testCityId
      });

      // Simulate vendor registration flow - fetch zones
      const zones = await Zone.find({ city: testCityId }).lean();

      expect(zones).toHaveLength(2);
      
      // Verify coordinates field is present
      const zoneWithCoords = zones.find(z => z.name === 'Vendor Zone With Coords');
      const zoneWithoutCoords = zones.find(z => z.name === 'Vendor Zone Without Coords');

      expect(zoneWithCoords.coordinates).toBeDefined();
      expect(zoneWithCoords.coordinates).toHaveLength(5);
      expect(zoneWithoutCoords.coordinates).toBeNull();
    });
  });

  describe('Backward compatibility - existing functionality preserved', () => {
    it('should not break existing zone retrieval when coordinates field is added', async () => {
      // Create old-style zone (simulating existing data)
      await Zone.create({
        name: 'Legacy Zone',
        city: testCityId
      });

      // Mock request and response
      const req = {
        params: { cityId: testCityId.toString() }
      };
      const res = {
        json: function(data) {
          this.data = data;
          return this;
        }
      };

      await AdminController.listZones(req, res);

      expect(res.data.zones).toHaveLength(1);
      expect(res.data.zones[0].name).toBe('Legacy Zone');
      expect(res.data.zones[0].city).toBeDefined();
      expect(res.data.zones[0].coordinates).toBeNull();
    });

    it('should return all zone fields including coordinates', async () => {
      const validCoordinates = [
        { lat: 28.6139, lng: 77.2090 },
        { lat: 28.6140, lng: 77.2091 },
        { lat: 28.6141, lng: 77.2092 },
        { lat: 28.6142, lng: 77.2093 },
        { lat: 28.6143, lng: 77.2094 }
      ];

      await Zone.create({
        name: 'Complete Zone',
        city: testCityId,
        status: 'active',
        coordinates: validCoordinates
      });

      const req = {
        params: { cityId: testCityId.toString() }
      };
      const res = {
        json: function(data) {
          this.data = data;
          return this;
        }
      };

      await AdminController.listZones(req, res);

      const zone = res.data.zones[0];
      expect(zone._id).toBeDefined();
      expect(zone.name).toBe('Complete Zone');
      expect(zone.city).toBeDefined();
      expect(zone.status).toBe('active');
      expect(zone.coordinates).toHaveLength(5);
      expect(zone.createdAt).toBeDefined();
      expect(zone.updatedAt).toBeDefined();
    });
  });
});
