import { z } from 'zod';
import { OkResultOf } from './global.schema';

const DeliveryStatusEntitySchema = z.object({
    id: z.number(),
    title: z.string(),
}).loose();

const DeliveryAssignmentSchema = z.object({
    id: z.number(),
    order: z.number(),
    deliveryCost: z.union([z.number(), z.string()]),
    deliveryCostInLocalCurrency: z.union([z.number(), z.string()]).optional(),
    contact: z.string(),
    amountToBeCharged: z.union([z.number(), z.string()]),
    phone: z.string(),
    shipmentId: z.string(),
    deliveryAddress: z.string(),
    isGroup: z.boolean(),
    deliveryStatus: DeliveryStatusEntitySchema,
}).loose();

const DeliveryAssignmentArraySchema = z.array(DeliveryAssignmentSchema);

/** OkResult wrapping an array of delivery assignments */
export const OkDeliveryArraySchema = OkResultOf(DeliveryAssignmentArraySchema);

/** OkResult wrapping a single delivery assignment */
export const OkDeliverySchema = OkResultOf(DeliveryAssignmentSchema);

type DeliveryAssignment = z.infer<typeof DeliveryAssignmentSchema>;

// ---------------------------------------------------------------------------
// Optimized Route
// ---------------------------------------------------------------------------

const RouteWaypointSchema = z.object({
    assignmentId: z.number(),
    address: z.string(),
    location: z.object({
        lat: z.number(),
        lng: z.number(),
    }),
    order: z.number(),
    estimatedArrival: z.string().optional(),
    contact: z.string(),
    phone: z.string(),
}).loose();

const OptimizedRouteSchema = z.object({
    courierId: z.number(),
    waypoints: z.array(RouteWaypointSchema),
    totalDistance: z.number(),
    totalDuration: z.number(),
    geometry: z.unknown().optional(),
}).loose();

/** OkResult wrapping an optimized route (nullable when no active deliveries) */
export const OkOptimizedRouteSchema = OkResultOf(OptimizedRouteSchema.nullable());

type RouteWaypoint = z.infer<typeof RouteWaypointSchema>;
type OptimizedRoute = z.infer<typeof OptimizedRouteSchema>;
