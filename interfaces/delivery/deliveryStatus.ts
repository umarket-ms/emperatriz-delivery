import { IDeliveryStatusEntity } from './delivery';
import { CustomColors } from '@/constants/CustomColors';

export enum IDeliveryStatus {
    PENDING = 'pendiente',
    ASSIGNED = 'asignado',
    IN_PROGRESS = 'en progreso',
    DELIVERED = 'entregado',
    CANCELLED = 'cancelado',
    RETURNED = 'devuelto',
    ON_HOLD = 'en espera',
    SCHEDULED = 'programado',
}

// Variable global para almacenar los estados obtenidos del backend
let deliveryStatuses: IDeliveryStatusEntity[] = [];

/**
 * Establece los estados de entrega obtenidos del backend
 */
export function setDeliveryStatuses(statuses: IDeliveryStatusEntity[]): void {
    deliveryStatuses = statuses;
}

/**
 * Obtiene todos los estados de entrega cargados
 */
export function getDeliveryStatuses(): IDeliveryStatusEntity[] {
    return deliveryStatuses;
}

// Define valid status transitions - what status can progress to what other statuses
export const validStatusTransitions: Record<IDeliveryStatus, IDeliveryStatus[]> = {
    [IDeliveryStatus.PENDING]: [
        IDeliveryStatus.ASSIGNED,
        IDeliveryStatus.SCHEDULED,
        IDeliveryStatus.CANCELLED,
        IDeliveryStatus.ON_HOLD,
    ],
    [IDeliveryStatus.ASSIGNED]: [
        IDeliveryStatus.IN_PROGRESS,
        IDeliveryStatus.CANCELLED,
        IDeliveryStatus.ON_HOLD,
        IDeliveryStatus.SCHEDULED,
    ],
    [IDeliveryStatus.SCHEDULED]: [
        IDeliveryStatus.ASSIGNED,
        IDeliveryStatus.IN_PROGRESS,
        IDeliveryStatus.CANCELLED,
        IDeliveryStatus.ON_HOLD,
    ],
    [IDeliveryStatus.IN_PROGRESS]: [
        IDeliveryStatus.DELIVERED,
        IDeliveryStatus.ON_HOLD,
        IDeliveryStatus.CANCELLED,
    ],
    [IDeliveryStatus.DELIVERED]: [],
    [IDeliveryStatus.RETURNED]: [],
    [IDeliveryStatus.ON_HOLD]: [
        IDeliveryStatus.IN_PROGRESS,
        IDeliveryStatus.CANCELLED,
        IDeliveryStatus.SCHEDULED,
    ],
    [IDeliveryStatus.CANCELLED]: [],
};

// Helper functions
export function getStatusColor(status: string): string {
    switch (status) {
        case IDeliveryStatus.PENDING:
            return CustomColors.warning;
        case IDeliveryStatus.ASSIGNED:
            return CustomColors.info;
        case IDeliveryStatus.SCHEDULED:
            return CustomColors.teal;
        case IDeliveryStatus.IN_PROGRESS:
            return CustomColors.violet;
        case IDeliveryStatus.DELIVERED:
            return CustomColors.success;
        case IDeliveryStatus.RETURNED:
            return CustomColors.orange;
        case IDeliveryStatus.ON_HOLD:
            return CustomColors.slate;
        case IDeliveryStatus.CANCELLED:
            return CustomColors.error;
        default:
            return CustomColors.slate;
    }
}

function getNextValidStatuses(currentStatus: string): IDeliveryStatus[] {
    // Find the matching DeliveryStatus enum value
    const matchingStatus = Object.values(IDeliveryStatus).find(
        status => status === currentStatus
    );

    if (matchingStatus) {
        // Return the valid transitions for this status
        const statusKey = Object.keys(IDeliveryStatus).find(
            key => IDeliveryStatus[key as keyof typeof IDeliveryStatus] === matchingStatus
        ) as keyof typeof IDeliveryStatus;
        
        return validStatusTransitions[IDeliveryStatus[statusKey]];
    }
    
    // If no matching status is found, return an empty array
    return [];
}

/**
 * Obtiene el ID de un estado basado en su título
 */
export function getStatusIdFromTitle(statusTitle: string): number | null {
    const status = deliveryStatuses.find(s => s.title === statusTitle);
    return status ? status.id : null;
}

/**
 * Obtiene el título de un estado basado en su ID
 */
function getStatusTitleFromId(statusId: number): string | null {
    const status = deliveryStatuses.find(s => s.id === statusId);
    return status ? status.title : null;
}

/**
 * Verifica si los estados están cargados
 */
export function areStatusesLoaded(): boolean {
    return deliveryStatuses.length > 0;
}
