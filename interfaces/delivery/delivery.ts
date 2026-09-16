import type { AssignmentType } from "@/utils/enum";
import type { IGlobalEntity } from "../global";
import type { IDeliveryPerson } from "../carrier";
import type { IEnterpriseEntity } from "../auth";
import type { IDeliveryStatus } from "./deliveryStatus";
import type { IPaymentMethodEntity } from "../payment/payment";
import type { ProductEntity } from "../product";

export interface IUpdateDelivery extends Partial<ICreateDeliveryAssigment>{}

export interface IGpsReading {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  speed?: number;
  isMocked?: boolean;
}

export interface IUpdateDeliveryStatusData {
  id: string;
  status: number;
  note?: string;
  imageUris?: string[];
  amountPaid?: number;
  additionalAmount?: number;
  paymentMethodId?: number;
  gpsReadings?: IGpsReading[];
  verificationCode?: string;
  scheduledAt?: string;
}

export interface IDeliveryAssignmentSummaryEntity extends IGlobalEntity {
  id: number;
  order: number;
  deliveryCost: number;
  contact: string;
  amountToBeCharged: number;
  phone: string;
  amountPaid?: number;
  deliveryAddress: string;
  observations?: string;
  shipmentId: string;
  type: AssignmentType;
  deliveryStatus: IDeliveryStatusEntity;
  assignedAt: Date;
  acceptedAt: Date;
  completedAt: Date;
  driver: IDeliveryPerson;
  paymentMethod?: IPaymentMethodEntity;
  originNominatimId: number | null;
  destinyNominatimId: number | null;
  enterprise:IEnterpriseEntity;
}

export interface IDeliveryAssignmentEntity extends IGlobalEntity {
  id: number;
  order: number;
  deliveryCost: number;
  contact: string;
  amountToBeCharged: number;
  amountPaid?: number;
  phone: string;
  shipmentId: string;
  type: AssignmentType;
  deliveryAddress: string;
  observations?: string;
  originNominatimId: number | null;
  destinyNominatimId: number | null;
  originNominatimLat: number | null;
  originNominatimLng: number | null;
  destinyNominatimLat: number | null;
  destinyNominatimLng: number | null;
  deliveryStatus: IDeliveryStatusEntity;
  paymentMethod?: IPaymentMethodEntity;
  assignedAt: Date;
  acceptedAt: Date;
  completedAt: Date;
  relatedOrder?: OrderEntity;
  driver: IDeliveryPerson;
  isGroup: boolean;
  deliveryVerificationCode?: string;
  enterprise: IEnterpriseEntity;
  deliveryAssignmentDetails?: DeliveryAssignmentDetailEntity[];
}

export interface DeliveryAssignmentDetailEntity {
  id: number;
  shipmentId: string;
  quantity: number | null;
  unitPrice: number;
  sellerUnitPrice: number;
  additionalAmount: number | null;
  productTitle: string | null;
  orderSource: string;
  type: string;
  productId: number | null;
  productVariationSelectedId: number | null;
  deliveryAssignmentId: number;
  enterpriseId: number | null;
  status: string | null;
  imageUrl: string | null;
}

export interface OrderEntity extends IGlobalEntity {
  id: number;
  shipmentId: string
  deliveryAddress: string
  deliveryDate?: Date
  isDelivered?: boolean
  observations?: string
  statusObservations?: string
  orderDetails: OrderDetailEntity[]
}

export interface OrderDetailEntity {
  id: number;
  shipmentId: string;
  quantity: number;
  unitPrice: number;
  additionalAmount?: number;
  productTitle: string;
  type: 'PRODUCT' | 'DELIVERY' | 'PICKUP';
  product: ProductEntity;
  order: OrderEntity;
}
// agregar aqui interfaz de ProductEntity
export interface AdditionalDataNominatimEntity {
  id: number;
  place_id: number
  licence: string
  osm_type: string
  osm_id: number
  lat: string
  lon: string
  class: string
  type: string
  place_rank: number
  importance: number
  addresstype: string
  name: string
  display_name: string
  boundingbox: string[]
  svg: string
  address: Address
}

export interface Address {
  id: number;
  neighbourhood: string;
  city: string;
  county: string;
  state: string;
  ISO3166_2_lvl4: string;
  postcode: string;
  country: string;
  country_code: string;
}
export interface IDeliveryInfoDto {
  phone: string;
  contact: string;
  amountToBeCharged?: number;
  deliveryAddress: string;
  observations?: string;
}

export interface ICreateDeliveryAssigment extends IDeliveryInfoDto{
  destinies: IDeliveryInfoDto[]
}


export interface IDeliveryStatusEntity {
  id: number;
  title: IDeliveryStatus;
}

export interface IDeliveryCost {
  id: number;
  value: number;
  description: string;
}