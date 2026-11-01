import { IDeliveryAssignmentEntity } from './delivery';

/**
 * Entrega disponible para auto-asignación (despacho híbrido).
 * Espejo del DTO `AvailableDeliveryItem` del backend
 * (delivery_assignments/services/self-assignment/self-assignment.types.ts).
 */
export interface AvailableDeliveryItem {
  id: number;
  shipmentId: string;
  type: string;
  order: number;
  contact: string;
  phone: string;
  deliveryAddress: string;
  observations: string | null;
  scheduledAt: string | null;
  deliveryCost: number;
  clientTitle: string | null;
  clientPhone: string | null;
  originLat: number | null;
  originLon: number | null;
  destinyLat: number | null;
  destinyLon: number | null;
  /** Distancia en metros desde la ubicación actual del mensajero; null si no hay ubicación */
  distanceMeters: number | null;
  /** Score 0-100 (proximidad + compatibilidad de vehículo); mayor = más recomendada */
  score: number;
  vehicleCompatible: boolean;
  createdAt: string | null;
}

export interface ClaimDeliveryResponse {
  assignments: IDeliveryAssignmentEntity[];
  route: unknown | null;
}

/**
 * Grupo de viajes de un mismo envío (shipmentId) listo para reclamo en lote:
 * el backend asigna el shipment completo de una sola vez.
 */
export interface AvailableShipmentGroup {
  shipmentId: string;
  /** Viajes del envío, con la recogida primero y luego las entregas. */
  items: AvailableDeliveryItem[];
  /** Score mínimo del grupo (el viaje peor puntuado manda). */
  score: number;
  /** Distancia mínima no nula entre los viajes del grupo. */
  distanceMeters: number | null;
  /** true solo si todos los viajes son compatibles con el vehículo. */
  vehicleCompatible: boolean;
}
