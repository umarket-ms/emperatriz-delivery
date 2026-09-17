import { IDeliveryAssignmentEntity, OrderEntity, DeliveryAssignmentDetailEntity } from "../delivery/delivery";
import { AssignmentType } from "@/utils/enum";
import { IDeliveryStatusEntity } from "../delivery/delivery";
import { Capitalize } from "@/utils/capitalize";

// Interfaz adaptada para trabajar con los datos del backend
export interface DeliveryItemAdapter {
  id: string;
  title: string;
  client: string;
  phone: string;
  type: AssignmentType;
  deliveryStatus: IDeliveryStatusEntity;
  deliveryAddress: string;
  observations?: string;
  status?: string;
  originNominatimId: number | null;
  destinyNominatimId: number | null;
  originNominatimLat: number | null;
  originNominatimLng: number | null;
  destinyNominatimLat: number | null;
  destinyNominatimLng: number | null;
  relatedOrder?: OrderEntity;
  deliveryAssignmentDetails?: DeliveryAssignmentDetailEntity[];
  shipmentId: string;
  deliveryCost: number;
  deliveryCostInLocalCurrency: number;
  amountToBeCharged: number;
  enterprise: string;
  deliveryVerificationCode?: string;
  isGroup: boolean;
}

// Interfaz para representar un grupo de entregas
export interface DeliveryGroupAdapter {
  shipmentId: string;
  pickups: DeliveryItemAdapter[];
  delivery: DeliveryItemAdapter;
  totalDeliveryCost: number;
  totalAmountToBeCharged: number;
}

// Convierte un array de IDeliveryAssignmentEntity a DeliveryItemAdapter
export function adaptDeliveriesToAdapter(deliveries: IDeliveryAssignmentEntity[]): DeliveryItemAdapter[] {    
  try {
    return deliveries.map(delivery => ({
      id: delivery.id.toString(),
      title: delivery.deliveryAddress || '',
      client: Capitalize(delivery.contact),
      phone: delivery.phone,
      type: delivery.type,
      deliveryStatus: delivery.deliveryStatus,
      deliveryAddress: delivery.deliveryAddress,
      observations: delivery.observations,
      status: delivery.status,
      originNominatimId: delivery.originNominatimId ?? null,
      destinyNominatimId: delivery.destinyNominatimId ?? null,
      originNominatimLat: (delivery as any).originNominatimLat ?? null,
      originNominatimLng: (delivery as any).originNominatimLng ?? null,
      destinyNominatimLat: (delivery as any).destinyNominatimLat ?? null,
      destinyNominatimLng: (delivery as any).destinyNominatimLng ?? null,
      isGroup: delivery.isGroup || false,
      shipmentId: delivery.shipmentId,
      deliveryCost: Number(delivery.deliveryCost),
      deliveryCostInLocalCurrency: Number((delivery as any).deliveryCostInLocalCurrency ?? delivery.deliveryCost),
      amountToBeCharged: Number((delivery as any).amountToBeCharged ?? (delivery as any).cost ?? 0),
      relatedOrder: delivery.relatedOrder,
      deliveryAssignmentDetails: (delivery as any).deliveryAssignmentDetails,
      enterprise: delivery.enterprise.title,
      deliveryVerificationCode: delivery.deliveryVerificationCode,
    }));    
  } catch (error:any) {
    console.log('Error al adaptar entregas:', error);
    return [];
  }
}

// Función para agrupar entregas por shipmentId cuando isGroup = true
function groupDeliveriesByShipment(deliveries: DeliveryItemAdapter[]): (DeliveryItemAdapter | DeliveryGroupAdapter)[] {
  const groupedDeliveries: Map<string, DeliveryItemAdapter[]> = new Map();
  const individualDeliveries: DeliveryItemAdapter[] = [];

  // Separar entregas grupales de individuales
  deliveries.forEach(delivery => {
    if (delivery.isGroup) {
      const existing = groupedDeliveries.get(delivery.shipmentId) || [];
      existing.push(delivery);
      groupedDeliveries.set(delivery.shipmentId, existing);
    } else {
      individualDeliveries.push(delivery);
    }
  });

  const result: (DeliveryItemAdapter | DeliveryGroupAdapter)[] = [];

  // Agregar entregas individuales
  result.push(...individualDeliveries);

  // Procesar grupos
  groupedDeliveries.forEach((groupItems, shipmentId) => {
    const pickups = groupItems.filter(item => item.type === AssignmentType.PICKUP);
    const deliveryItem = groupItems.find(item => item.type === AssignmentType.DELIVERY);

    if (deliveryItem) {
      const group: DeliveryGroupAdapter = {
        shipmentId,
        pickups,
        delivery: deliveryItem,
        totalDeliveryCost: groupItems.reduce((sum, item) => sum + Number(item.deliveryCostInLocalCurrency ?? item.deliveryCost), 0),
        totalAmountToBeCharged: groupItems.reduce((sum, item) => sum + Number((item as any).amountToBeCharged ?? (item as any).deliveryCost ?? 0), 0),
      };
      result.push(group);
    }
  });

  return result;
}