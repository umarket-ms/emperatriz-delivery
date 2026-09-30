import { z } from 'zod';
import { OkResultOf } from './global.schema';

/**
 * Espejo del DTO AvailableDeliveryItem del backend
 * (delivery_assignments/services/self-assignment/self-assignment.types.ts).
 */
const AvailableDeliveryItemSchema = z.object({
    id: z.number(),
    shipmentId: z.string(),
    type: z.string(),
    order: z.number(),
    contact: z.string(),
    phone: z.string(),
    deliveryAddress: z.string(),
    observations: z.string().nullable(),
    scheduledAt: z.string().nullable(),
    deliveryCost: z.union([z.number(), z.string()]),
    clientTitle: z.string().nullable(),
    clientPhone: z.string().nullable(),
    originLat: z.number().nullable(),
    originLon: z.number().nullable(),
    destinyLat: z.number().nullable(),
    destinyLon: z.number().nullable(),
    distanceMeters: z.number().nullable(),
    score: z.number(),
    vehicleCompatible: z.boolean(),
    createdAt: z.string().nullable(),
}).loose();

/**
 * Respuesta de POST /delivery-assignments/driver/claim (lote) y
 * POST /delivery-assignments/driver/claim/:id: el backend asigna el grupo
 * completo del envío y responde con todas las asignaciones resultantes.
 */
const ClaimDeliveryResponseSchema = z.object({
    assignments: z.array(z.object({ id: z.number() }).loose()),
    route: z.unknown().nullable(),
}).loose();

/** Respuesta de DELETE /delivery-assignments/driver/claim/:id */
const ReleaseDeliveryResponseSchema = z.object({
    message: z.string(),
}).loose();

/** OkResult con la lista de entregas disponibles (self-assignment) */
export const OkAvailableDeliveryArraySchema = OkResultOf(
    z.array(AvailableDeliveryItemSchema),
);

/** OkResult con la respuesta de reclamar o liberar una entrega */
export const OkClaimDeliverySchema = OkResultOf(
    z.union([ClaimDeliveryResponseSchema, ReleaseDeliveryResponseSchema]),
);
