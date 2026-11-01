import { z } from 'zod';
import { OkLoginResponseSchema } from './schemas/auth.schema';
import { OkDeliveryArraySchema, OkOptimizedRouteSchema, OkDeliverySchema } from './schemas/delivery.schema';
import { OkAvailableDeliveryArraySchema, OkClaimDeliverySchema } from './schemas/available.schema';
import { OkDeliveryStatusArraySchema } from './schemas/deliveryStatus.schema';
import { OkPaymentMethodArraySchema } from './schemas/paymentMethod.schema';
import { OkOsrmTripSchema, OkOsrmRouteSchema } from './schemas/osrm.schema';

// use the broadly-typed base to avoid deprecated signatures
// and to allow any schema shape
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySchema = z.ZodTypeAny;

const OkResultOf = <T extends z.ZodTypeAny>(schema: T) =>
    z.object({ ok: z.literal(true), value: schema }).loose();

/**
 * Maps endpoint path prefixes to Zod schemas.
 */
const schemaRegistry: Record<string, AnySchema> = {
    '/auth/login-delivery':                OkLoginResponseSchema,
    '/delivery-assignments/courier':       OkOptimizedRouteSchema,

    // Ganancias — delivery driver stats (more specific before generic prefix)
    '/delivery-assignments/driver/stats': OkResultOf(z.number()),

    // Despacho híbrido — self-assignment (más específico antes del genérico)
    '/delivery-assignments/driver/available': OkAvailableDeliveryArraySchema,
    '/delivery-assignments/driver/claim': OkClaimDeliverySchema,

    '/delivery-assignments/driver/top-route': OkResultOf(z.union([
        z.object({
            routeName: z.string(),
            deliveryCount: z.number(),
            totalEarnings: z.number(),
        }),
        z.null(),
    ])),
    '/delivery-assignments/driver/recent-deliveries': OkResultOf(z.array(z.object({
        id: z.number(),
        contact: z.string(),
        zone: z.string(),
        completedAt: z.string(),
    }))),

    // generic list response used by /delivery-assignments (GET)
    '/delivery-assignments':               OkDeliveryArraySchema,
    '/delivery-status':      OkDeliveryStatusArraySchema,
    '/payment-methods':      OkPaymentMethodArraySchema,
    '/admin/osrm/trip':      OkOsrmTripSchema,
    '/admin/osrm/route':     OkOsrmRouteSchema,

    // CXP Invoices — ganancias data (more specific before generic)
    '/cxp-invoices/seller/earnings': OkResultOf(z.object({
        weekTotal: z.number(),
        monthTotal: z.number(),
        invoiceCount: z.number(),
    })),
    '/cxp-invoices/seller/monthly-stats': OkResultOf(z.array(z.object({
        month: z.string(),
        value: z.number(),
    }))),
    '/cxp-invoices/seller/weekly-stats': OkResultOf(z.array(z.object({
        day: z.string(),
        value: z.number(),
    }))),
    '/cxp-invoices/seller/paid-invoices': OkResultOf(z.array(z.object({
        id: z.number(),
        invoiceNumber: z.string(),
        issueDate: z.string(),
        dueDate: z.string(),
        totalAmount: z.number(),
        status: z.string(),
    }))),
};

/**
 * Finds the first registered schema whose key is a prefix of the given URL.
 * Supports dynamic segments, e.g. /delivery-assignments/123 matches /delivery-assignments.
 */
export function findSchema(url: string): AnySchema | undefined {
    const normalized = url.startsWith('/') ? url : `/${url}`;

    // special case: batch status-unified returns an array
    if (/^\/delivery-assignments\/batch\/status-unified($|\/|\?)/.test(normalized)) {
        return OkDeliveryArraySchema;
    }

    // special case: single assignment returned when updating status, status-with-images, or status-unified
    if (/^\/delivery-assignments\/\d+\/status(-with-images|-unified)?($|\/|\?)/.test(normalized)) {
        return OkDeliverySchema;
    }

    const key = Object.keys(schemaRegistry).find(
        (k) =>
            normalized === k ||
            normalized.startsWith(`${k}/`) ||
            normalized.startsWith(`${k}?`),
    );
    return key ? schemaRegistry[key] : undefined;
}
