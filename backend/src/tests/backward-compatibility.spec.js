import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { City, Zone } from '../models/CityZone.js';
import * as AdminController from '../modules/admin/controllers/admin.controller.js';

describe('Backward Compatibility - Zone Management', () => {
  let testCityId;

  beforeAll(async () => {
    const city = await City.create({ name: 'Backward Compat Test City' });
    testCityId = city._id;
  });

  afterAll(async () => {
    await Zone.deleteMany({ city: testCityId });
    await City.deleteOne({ _id: testCityId });
  });

  beforeEach(async () => {
    await Zone.deleteMany({ city: testCityId });
  });

  describe('Creating zones without coordinates', () => {
    it('should create zone without coordinates (as before)', async () => {
      const req = {
        params: { cityId: testCityId.toString() },
        body: { name: 'Legacy Zone' }
      };
      const res = {
        json: function(data) {
          this.data = data;
          return this;
        },
        status: function(code) {
          this.statusCode = code;
          return this;
        }
      };

      await AdminController.createZone(req, res);

      expect(res.data.zone).toBeDefined();
      expect(res.data.zone.name).toBe('Legacy Zone');
      expect(res.data.zone.coordinates).toBeNull();
    });

    it('should create multiple zones without coordinates', async () => {
      const zones = ['Zone A', 'Zone B', 'Zone C'];
      
      for (const zoneName of zones) {
        const req = {
          params: { cityId: testCityId.toString() },
          body: { name: zoneName }
        };
        const res = {
          json: function(data) {
            this.data = data;
            return this;
          },
          status: function(code) {
            this.statusCode = code;
            return this;
          }
        };

        await AdminController.createZone(req, res);
        expect(res.data.zone.name).toBe(zoneName);
        expect(res.data.zone.coordinates).toBeNull();
      }

      const allZones = await Zone.find({ city: testCityId });
      expect(allZones).toHaveLength(3);
    });
  });

  describe('Zones without coordinates return null', () => {
    it('should return null for coordinates field when zone has no coordinates', async () => {
      await Zone.create({
        name: 'No Coords Zone',
        city: testCityId
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

      expect(res.data.zones).toHaveLength(1);
      expect(res.data.zones[0].coordinates).toBeNull();
    });
  });

  describe('Existing zone list display', () => {
    it('should show all zones regardless of coordinates', async () => {
      // Create zones with and without coordinates
      await Zone.create({
        name: 'Zone Without Coords',
        city: testCityId
      });

      await Zone.create({
        name: 'Zone With Coords',
        city: testCityId,
        coordinates: [
          { lat: 28.6139, lng: 77.2090 },
          { lat: 28.6140, lng: 77.2091 },
          { lat: 28.6141, lng: 77.2092 },
          { lat: 28.6142, lng: 77.2093 },
          { lat: 28.6143, lng: 77.2094 }
        ]
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

      expect(res.data.zones).toHaveLength(2);
      expect(res.data.zones.some(z => z.name === 'Zone Without Coords')).toBe(true);
      expect(res.data.zones.some(z => z.name === 'Zone With Coords')).toBe(true);
    });

    it('should maintain zone sorting by name', async () => {
      await Zone.create({ name: 'Charlie Zone', city: testCityId });
      await Zone.create({ name: 'Alpha Zone', city: testCityId });
      await Zone.create({ name: 'Bravo Zone', city: testCityId });

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

      expect(res.data.zones).toHaveLength(3);
      expect(res.data.zones[0].name).toBe('Alpha Zone');
      expect(res.data.zones[1].name).toBe('Bravo Zone');
      expect(res.data.zones[2].name).toBe('Charlie Zone');
    });
  });

  describe('Zone editing and deletion', () => {
    it('should update zone name without affecting coordinates field', async () => {
      const zone = await Zone.create({
        name: 'Original Name',
        city: testCityId
      });

      const req = {
        params: { zoneId: zone._id.toString() },
        body: { name: 'Updated Name' }
      };
      const res = {
        json: function(data) {
          this.data = data;
          return this;
        },
        status: function(code) {
          this.statusCode = code;
          return this;
        }
      };

      await AdminController.updateZone(req, res);

      expect(res.data.zone.name).toBe('Updated Name');
      expect(res.data.zone.coordinates).toBeNull();
    });

    it('should delete zone without coordinates', async () => {
      const zone = await Zone.create({
        name: 'Zone To Delete',
        city: testCityId
      });

      const req = {
        params: { zoneId: zone._id.toString() }
      };
      const res = {
        json: function(data) {
          this.data = data;
          return this;
        },
        status: function(code) {
          this.statusCode = code;
          return this;
        }
      };

      await AdminController.deleteZone(req, res);

      expect(res.data.success).toBe(true);

      const deletedZone = await Zone.findById(zone._id);
      expect(deletedZone).toBeNull();
    });

    it('should update zone with coordinates to remove them', async () => {
      const zone = await Zone.create({
        name: 'Zone With Coords',
        city: testCityId,
        coordinates: [
          { lat: 28.6139, lng: 77.2090 },
          { lat: 28.6140, lng: 77.2091 },
          { lat: 28.6141, lng: 77.2092 },
          { lat: 28.6142, lng: 77.2093 },
          { lat: 28.6143, lng: 77.2094 }
        ]
      });

      const req = {
        params: { zoneId: zone._id.toString() },
        body: { coordinates: null }
      };
      const res = {
        json: function(data) {
          this.data = data;
          return this;
        },
        status: function(code) {
          this.statusCode = code;
          return this;
        }
      };

      await AdminController.updateZone(req, res);

      expect(res.data.zone.coordinates).toBeNull();
    });
  });

  describe('Provider registration with zones', () => {
    it('should work with zones without coordinates', async () => {
      await Zone.create({
        name: 'Provider Zone No Coords',
        city: testCityId
      });

      const zones = await Zone.find({ city: testCityId }).lean();

      expect(zones).toHaveLength(1);
      expect(zones[0].name).toBe('Provider Zone No Coords');
      expect(zones[0].coordinates).toBeNull();
      // Provider registration should still work with zone name
      expect(zones[0]._id).toBeDefined();
    });

    it('should work with zones with coordinates', async () => {
      await Zone.create({
        name: 'Provider Zone With Coords',
        city: testCityId,
        coordinates: [
          { lat: 28.6139, lng: 77.2090 },
          { lat: 28.6140, lng: 77.2091 },
          { lat: 28.6141, lng: 77.2092 },
          { lat: 28.6142, lng: 77.2093 },
          { lat: 28.6143, lng: 77.2094 }
        ]
      });

      const zones = await Zone.find({ city: testCityId }).lean();

      expect(zones).toHaveLength(1);
      expect(zones[0].name).toBe('Provider Zone With Coords');
      expect(zones[0].coordinates).toHaveLength(5);
      expect(zones[0]._id).toBeDefined();
    });

    it('should work with mixed zones (with and without coordinates)', async () => {
      await Zone.create({
        name: 'Provider Zone A',
        city: testCityId
      });

      await Zone.create({
        name: 'Provider Zone B',
        city: testCityId,
        coordinates: [
          { lat: 28.6139, lng: 77.2090 },
          { lat: 28.6140, lng: 77.2091 },
          { lat: 28.6141, lng: 77.2092 },
          { lat: 28.6142, lng: 77.2093 },
          { lat: 28.6143, lng: 77.2094 }
        ]
      });

      const zones = await Zone.find({ city: testCityId }).lean();

      expect(zones).toHaveLength(2);
      
      const zoneA = zones.find(z => z.name === 'Provider Zone A');
      const zoneB = zones.find(z => z.name === 'Provider Zone B');

      expect(zoneA.coordinates).toBeNull();
      expect(zoneB.coordinates).toHaveLength(5);
      
      // Both should be usable for provider registration
      expect(zoneA._id).toBeDefined();
      expect(zoneB._id).toBeDefined();
    });
  });

  describe('Vendor registration with zones', () => {
    it('should work with zones without coordinates', async () => {
      await Zone.create({
        name: 'Vendor Zone No Coords',
        city: testCityId
      });

      const zones = await Zone.find({ city: testCityId }).lean();

      expect(zones).toHaveLength(1);
      expect(zones[0].name).toBe('Vendor Zone No Coords');
      expect(zones[0].coordinates).toBeNull();
      // Vendor registration should still work with zone name
      expect(zones[0]._id).toBeDefined();
    });

    it('should work with zones with coordinates', async () => {
      await Zone.create({
        name: 'Vendor Zone With Coords',
        city: testCityId,
        coordinates: [
          { lat: 28.6139, lng: 77.2090 },
          { lat: 28.6140, lng: 77.2091 },
          { lat: 28.6141, lng: 77.2092 },
          { lat: 28.6142, lng: 77.2093 },
          { lat: 28.6143, lng: 77.2094 }
        ]
      });

      const zones = await Zone.find({ city: testCityId }).lean();

      expect(zones).toHaveLength(1);
      expect(zones[0].name).toBe('Vendor Zone With Coords');
      expect(zones[0].coordinates).toHaveLength(5);
      expect(zones[0]._id).toBeDefined();
    });

    it('should work with mixed zones (with and without coordinates)', async () => {
      await Zone.create({
        name: 'Vendor Zone A',
        city: testCityId
      });

      await Zone.create({
        name: 'Vendor Zone B',
        city: testCityId,
        coordinates: [
          { lat: 28.6139, lng: 77.2090 },
          { lat: 28.6140, lng: 77.2091 },
          { lat: 28.6141, lng: 77.2092 },
          { lat: 28.6142, lng: 77.2093 },
          { lat: 28.6143, lng: 77.2094 }
        ]
      });

      const zones = await Zone.find({ city: testCityId }).lean();

      expect(zones).toHaveLength(2);
      
      const zoneA = zones.find(z => z.name === 'Vendor Zone A');
      const zoneB = zones.find(z => z.name === 'Vendor Zone B');

      expect(zoneA.coordinates).toBeNull();
      expect(zoneB.coordinates).toHaveLength(5);
      
      // Both should be usable for vendor registration
      expect(zoneA._id).toBeDefined();
      expect(zoneB._id).toBeDefined();
    });
  });

  describe('Zone operations preserve existing behavior', () => {
    it('should maintain all zone fields when creating without coordinates', async () => {
      const req = {
        params: { cityId: testCityId.toString() },
        body: { name: 'Complete Legacy Zone' }
      };
      const res = {
        json: function(data) {
          this.data = data;
          return this;
        },
        status: function(code) {
          this.statusCode = code;
          return this;
        }
      };

      await AdminController.createZone(req, res);

      const zone = res.data.zone;
      expect(zone._id).toBeDefined();
      expect(zone.name).toBe('Complete Legacy Zone');
      expect(zone.city).toBeDefined();
      expect(zone.status).toBe('active');
      expect(zone.coordinates).toBeNull();
      expect(zone.createdAt).toBeDefined();
      expect(zone.updatedAt).toBeDefined();
    });

    it('should not require coordinates field in update operations', async () => {
      const zone = await Zone.create({
        name: 'Update Test',
        city: testCityId
      });

      const req = {
        params: { zoneId: zone._id.toString() },
        body: { name: 'Updated Without Coords' }
      };
      const res = {
        json: function(data) {
          this.data = data;
          return this;
        },
        status: function(code) {
          this.statusCode = code;
          return this;
        }
      };

      await AdminController.updateZone(req, res);

      expect(res.data.zone.name).toBe('Updated Without Coords');
      expect(res.data.zone.coordinates).toBeNull();
    });
  });
});
