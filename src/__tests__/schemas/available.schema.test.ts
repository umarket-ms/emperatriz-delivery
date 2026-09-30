import {
  OkAvailableDeliveryArraySchema,
  OkClaimDeliverySchema,
} from '../../api/schemas/available.schema';
import { findSchema } from '../../api/schemaRegistry';
import { OkDeliveryArraySchema } from '../../api/schemas/delivery.schema';

describe('Available Delivery Schemas', () => {
  const validItem = {
    id: 7,
    shipmentId: 'SHIP-7',
    type: 'DELIVERY',
    order: 1,
    contact: 'Juan Perez',
    phone: '809-555-0101',
    deliveryAddress: 'Calle Falsa 123',
    observations: null,
    scheduledAt: null,
    deliveryCost: 250,
    clientTitle: 'Maria',
    clientPhone: '809-555-0102',
    originLat: 18.48,
    originLon: -69.93,
    destinyLat: 18.49,
    destinyLon: -69.94,
    distanceMeters: 1500,
    score: 82,
    vehicleCompatible: true,
    createdAt: '2026-09-29T10:00:00.000Z',
  };

  describe('OkAvailableDeliveryArraySchema', () => {
    it('should validate a correct available deliveries list', () => {
      const result = OkAvailableDeliveryArraySchema.safeParse({
        ok: true,
        value: [validItem],
      });
      expect(result.success).toBe(true);
    });

    it('should validate an empty list', () => {
      const result = OkAvailableDeliveryArraySchema.safeParse({
        ok: true,
        value: [],
      });
      expect(result.success).toBe(true);
    });

    it('should reject when a required field is missing', () => {
      const { score: _score, ...withoutScore } = validItem;
      const result = OkAvailableDeliveryArraySchema.safeParse({
        ok: true,
        value: [withoutScore],
      });
      expect(result.success).toBe(false);
    });

    it('should allow extra fields (loose schema)', () => {
      const withExtra = { ...validItem, deliveryCostInLocalCurrency: 5 };
      const result = OkAvailableDeliveryArraySchema.safeParse({
        ok: true,
        value: [withExtra],
      });
      expect(result.success).toBe(true);
    });

    it('should allow string or number for deliveryCost', () => {
      const withStringCost = { ...validItem, deliveryCost: '250.00' };
      const result = OkAvailableDeliveryArraySchema.safeParse({
        ok: true,
        value: [withStringCost],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('OkClaimDeliverySchema', () => {
    it('should validate a claim response with assignments and route', () => {
      const result = OkClaimDeliverySchema.safeParse({
        ok: true,
        value: {
          assignments: [
            { id: 7, driverId: 10, deliveryStatusId: 2 },
            { id: 8, driverId: 10, deliveryStatusId: 2 },
          ],
          route: null,
        },
      });
      expect(result.success).toBe(true);
    });

    it('should validate a release response with message', () => {
      const result = OkClaimDeliverySchema.safeParse({
        ok: true,
        value: { message: 'Entrega liberada y disponible para otros mensajeros' },
      });
      expect(result.success).toBe(true);
    });

    it('should reject when value is an array', () => {
      const result = OkClaimDeliverySchema.safeParse({
        ok: true,
        value: [validItem],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('findSchema routing', () => {
    it('routes driver/available to the available schema', () => {
      expect(findSchema('/delivery-assignments/driver/available')).toBe(
        OkAvailableDeliveryArraySchema,
      );
    });

    it('routes driver/claim/:id to the claim schema', () => {
      expect(findSchema('/delivery-assignments/driver/claim/7')).toBe(
        OkClaimDeliverySchema,
      );
    });

    it('routes driver/claim (group batch) to the claim schema', () => {
      expect(findSchema('/delivery-assignments/driver/claim')).toBe(
        OkClaimDeliverySchema,
      );
    });

    it('keeps by-driver on the generic delivery schema', () => {
      expect(findSchema('/delivery-assignments/by-driver')).toBe(
        OkDeliveryArraySchema,
      );
    });
  });
});
