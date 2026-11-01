import {
  OkDeliveryArraySchema,
  OkDeliverySchema,
  OkOptimizedRouteSchema,
} from '../../api/schemas/delivery.schema';

describe('Delivery Schemas', () => {
  const validDeliveryStatus = {
    id: 1,
    title: 'Pending',
  };

  const validAssignment = {
    id: 1,
    order: 1001,
    deliveryCost: 5.00,
    contact: 'John Doe',
    amountToBeCharged: 105.00,
    phone: '809-555-0101',
    shipmentId: 'SHIP-001',
    deliveryAddress: 'Main Street 123',
    isGroup: false,
    deliveryStatus: validDeliveryStatus,
  };

  describe('OkDeliverySchema', () => {
    it('should validate a correct delivery assignment', () => {
      const result = OkDeliverySchema.safeParse({
        ok: true,
        value: validAssignment,
      });
      expect(result.success).toBe(true);
    });

    it('should reject when ok is false', () => {
      const result = OkDeliverySchema.safeParse({
        ok: false,
        value: validAssignment,
      });
      expect(result.success).toBe(false);
    });

    it('should reject when deliveryStatus is missing', () => {
      const assignmentWithoutStatus = {
        ...validAssignment,
        deliveryStatus: undefined,
      };
      const result = OkDeliverySchema.safeParse({
        ok: true,
        value: assignmentWithoutStatus,
      });
      expect(result.success).toBe(false);
    });

    it('should allow string or number for deliveryCost', () => {
      const withStringCost = { ...validAssignment, deliveryCost: '5.00' };
      const result = OkDeliverySchema.safeParse({
        ok: true,
        value: withStringCost,
      });
      expect(result.success).toBe(true);
    });

    it('should allow string or number for amountToBeCharged', () => {
      const withStringAmount = { ...validAssignment, amountToBeCharged: '105.00' };
      const result = OkDeliverySchema.safeParse({
        ok: true,
        value: withStringAmount,
      });
      expect(result.success).toBe(true);
    });

    it('should allow extra fields (loose schema)', () => {
      const withExtra = { ...validAssignment, customField: 'custom' };
      const result = OkDeliverySchema.safeParse({
        ok: true,
        value: withExtra,
      });
      expect(result.success).toBe(true);
    });

    it('should accept scheduledAt as ISO string', () => {
      const scheduled = {
        ...validAssignment,
        scheduledAt: '2026-10-08T15:30:00.000Z',
      };
      const result = OkDeliverySchema.safeParse({ ok: true, value: scheduled });
      expect(result.success).toBe(true);
    });

    it('should accept scheduledAt as null', () => {
      const notScheduled = { ...validAssignment, scheduledAt: null };
      const result = OkDeliverySchema.safeParse({
        ok: true,
        value: notScheduled,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('OkDeliveryArraySchema', () => {
    it('should validate an array of delivery assignments', () => {
      const result = OkDeliveryArraySchema.safeParse({
        ok: true,
        value: [validAssignment],
      });
      expect(result.success).toBe(true);
    });

    it('should validate an empty array', () => {
      const result = OkDeliveryArraySchema.safeParse({
        ok: true,
        value: [],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('OkOptimizedRouteSchema', () => {
    const validWaypoint = {
      assignmentId: 1,
      address: 'Main Street 123',
      location: { lat: 18.4861, lng: -69.9312 },
      order: 1,
      contact: 'John Doe',
      phone: '809-555-0101',
    };

    const validRoute = {
      courierId: 1,
      waypoints: [validWaypoint],
      totalDistance: 5.5,
      totalDuration: 1200,
    };

    it('should validate a correct optimized route', () => {
      const result = OkOptimizedRouteSchema.safeParse({
        ok: true,
        value: validRoute,
      });
      expect(result.success).toBe(true);
    });

    it('should validate null route (no active deliveries)', () => {
      const result = OkOptimizedRouteSchema.safeParse({
        ok: true,
        value: null,
      });
      expect(result.success).toBe(true);
    });

    it('should validate route with multiple waypoints', () => {
      const multiWaypointRoute = {
        ...validRoute,
        waypoints: [
          validWaypoint,
          {
            assignmentId: 2,
            address: 'Second Street',
            location: { lat: 18.4900, lng: -69.9400 },
            order: 2,
            contact: 'Jane Doe',
            phone: '809-555-0102',
          },
        ],
      };
      const result = OkOptimizedRouteSchema.safeParse({
        ok: true,
        value: multiWaypointRoute,
      });
      expect(result.success).toBe(true);
    });

    it('should validate route with optional geometry', () => {
      const routeWithGeometry = {
        ...validRoute,
        geometry: { type: 'LineString', coordinates: [] },
      };
      const result = OkOptimizedRouteSchema.safeParse({
        ok: true,
        value: routeWithGeometry,
      });
      expect(result.success).toBe(true);
    });

    it('should validate waypoint with optional estimatedArrival', () => {
      const waypointWithETA = {
        ...validWaypoint,
        estimatedArrival: '2024-01-15T10:00:00Z',
      };
      const route = { ...validRoute, waypoints: [waypointWithETA] };
      const result = OkOptimizedRouteSchema.safeParse({
        ok: true,
        value: route,
      });
      expect(result.success).toBe(true);
    });

    it('should validate waypoint with optional scheduledAt', () => {
      const waypointWithSchedule = {
        ...validWaypoint,
        scheduledAt: '2026-10-08T15:30:00.000Z',
      };
      const route = { ...validRoute, waypoints: [waypointWithSchedule] };
      const result = OkOptimizedRouteSchema.safeParse({
        ok: true,
        value: route,
      });
      expect(result.success).toBe(true);
    });

    it('should validate waypoint with scheduledAt null', () => {
      const waypointWithNullSchedule = { ...validWaypoint, scheduledAt: null };
      const route = {
        ...validRoute,
        waypoints: [waypointWithNullSchedule],
      };
      const result = OkOptimizedRouteSchema.safeParse({
        ok: true,
        value: route,
      });
      expect(result.success).toBe(true);
    });
  });
});
