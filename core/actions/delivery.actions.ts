import {
  IDeliveryAssignmentEntity,
  IGpsReading,
  IUpdateDelivery,
  IUpdateDeliveryStatusData,
} from "@/interfaces/delivery/delivery";
import { apiAction } from "@/core/api/apiAction";
import { ApiEndpoints } from "@/utils/api-endpoints";
import {
  adaptDeliveriesToAdapter,
  DeliveryItemAdapter,
} from "@/interfaces/delivery/deliveryAdapters";

export const getDeliveries = async (
  filters?: Partial<IDeliveryAssignmentEntity>,
): Promise<DeliveryItemAdapter[]> => {
  let queryParams = "";
  if (filters) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString());
      }
    });
    queryParams = params.toString() ? `?${params.toString()}` : "";
  }
  return apiAction
    .get<
      IDeliveryAssignmentEntity[]
    >(`${ApiEndpoints.DeliveryAssignmentsByDriver}${queryParams}`)
    .then(adaptDeliveriesToAdapter);
};

const updateDeliveryStatus = (
  id: string,
  status: number,
  note?: string,
  amountPaid?: number,
  paymentMethodId?: number,
  additionalAmount?: number,
  gpsReadings?: IGpsReading[],
): Promise<IDeliveryAssignmentEntity> => {
  const payload: {
    status: number;
    note?: string;
    amountPaid?: number;
    paymentMethodId?: number;
    additionalAmount?: number;
    gpsReadings?: IGpsReading[];
  } = { status };

  if (note) payload.note = note;
  if (amountPaid !== undefined) payload.amountPaid = amountPaid;
  if (paymentMethodId !== undefined) payload.paymentMethodId = paymentMethodId;
  if (additionalAmount !== undefined)
    payload.additionalAmount = additionalAmount;
  if (gpsReadings?.length) payload.gpsReadings = gpsReadings;

  return apiAction.patch<IDeliveryAssignmentEntity>(
    `${ApiEndpoints.DeliveryAssignmentsStatus}`.replace('{id}', id),
    payload,
  );
};

const updateDeliveryStatusWithImages = (
  updateData: IUpdateDeliveryStatusData,
): Promise<IDeliveryAssignmentEntity> => {
  const {
    id,
    status,
    note,
    imageUris,
    amountPaid,
    paymentMethodId,
    additionalAmount,
    gpsReadings,
  } = updateData;

  if (!imageUris || imageUris.length === 0) {
    return updateDeliveryStatus(
      id,
      status,
      note,
      amountPaid,
      paymentMethodId,
      additionalAmount,
      gpsReadings,
    );
  }

  const formData = new FormData();
  formData.append("status", status.toString());
  if (note) formData.append("note", note);
  if (amountPaid !== undefined)
    formData.append("amountPaid", amountPaid.toString());
  if (paymentMethodId !== undefined)
    formData.append("paymentMethodId", paymentMethodId.toString());
  if (additionalAmount !== undefined)
    formData.append("additionalAmount", additionalAmount.toString());
  if (gpsReadings?.length)
    formData.append("gpsReadings", JSON.stringify(gpsReadings));

  imageUris.forEach((imageUri, index) => {
    formData.append("images", {
      uri: imageUri,
      type: "image/jpeg",
      name: `delivery_evidence_${id}_${index}_${Date.now()}.jpg`,
    } as any);
  });

  return apiAction.postFormData<IDeliveryAssignmentEntity>(
    `${ApiEndpoints.DeliveryAssignmentsStatusWithImages}`.replace('{id}', id),
    formData,
  );
};

export const updateDeliveryStatusUnified = (
  updateData: IUpdateDeliveryStatusData,
): Promise<IDeliveryAssignmentEntity> => {
  console.log("updateDeliveryStatusUnified called with: ", updateData);

  const {
    id,
    status,
    note,
    imageUris,
    amountPaid,
    paymentMethodId,
    additionalAmount,
    gpsReadings,
    verificationCode,
    scheduledAt,
  } = updateData;

  if (imageUris && imageUris.length > 0) {
    const formData = new FormData();
    formData.append("status", status.toString());
    if (note) formData.append("note", note);
    if (amountPaid !== undefined)
      formData.append("amountPaid", amountPaid.toString());
    if (paymentMethodId !== undefined)
      formData.append("paymentMethodId", paymentMethodId.toString());
    if (additionalAmount !== undefined)
      formData.append("additionalAmount", additionalAmount.toString());
    if (gpsReadings?.length)
      formData.append("gpsReadings", JSON.stringify(gpsReadings));
    if (verificationCode) formData.append("verificationCode", verificationCode);
    if (scheduledAt) formData.append("scheduledAt", scheduledAt);

    imageUris.forEach((imageUri, index) => {
      formData.append("images", {
        uri: imageUri,
        type: "image/jpeg",
        name: `delivery_evidence_${id}_${index}_${Date.now()}.jpg`,
      } as any);
    });

    return apiAction.patchFormData<IDeliveryAssignmentEntity>(
      `${ApiEndpoints.DeliveryAssignmentsStatusUnified}`.replace('{id}', id),
      formData,
    );
  }

  const payload: Record<string, unknown> = { status };
  if (note) payload.note = note;
  if (amountPaid !== undefined) payload.amountPaid = amountPaid;
  if (paymentMethodId !== undefined) payload.paymentMethodId = paymentMethodId;
  if (additionalAmount !== undefined)
    payload.additionalAmount = additionalAmount;
  if (gpsReadings?.length) payload.gpsReadings = gpsReadings;
  if (verificationCode) payload.verificationCode = verificationCode;
  if (scheduledAt) payload.scheduledAt = scheduledAt;

  return apiAction.patch<IDeliveryAssignmentEntity>(
    `${ApiEndpoints.DeliveryAssignmentsStatusUnified}`.replace('{id}', id),
    payload,
  );
};

export const updateDeliveryStatusBatch = (
  ids: number[],
  status: number,
  note?: string,
  amountPaid?: number,
  paymentMethodId?: number,
  additionalAmount?: number,
  gpsReadings?: IGpsReading[],
  imageUris?: string[],
  verificationCode?: string,
  scheduledAt?: string,
): Promise<IDeliveryAssignmentEntity[]> => {
  console.log("updateDeliveryStatusBatch called with: ", {
    ids,
    status,
    note,
    amountPaid,
    paymentMethodId,
    additionalAmount,
    gpsReadings,
    imageUris,
  });
  if (imageUris && imageUris.length > 0) {
    const formData = new FormData();
    ids.forEach((id) => {
      formData.append("ids", String(id));
    });
    formData.append("status", status.toString());
    if (note) formData.append("note", note);
    if (amountPaid !== undefined)
      formData.append("amountPaid", amountPaid.toString());
    if (paymentMethodId !== undefined)
      formData.append("paymentMethodId", paymentMethodId.toString());
    if (additionalAmount !== undefined)
      formData.append("additionalAmount", additionalAmount.toString());
    if (gpsReadings?.length)
      formData.append("gpsReadings", JSON.stringify(gpsReadings));
    if (verificationCode) formData.append("verificationCode", verificationCode);
    if (scheduledAt) formData.append("scheduledAt", scheduledAt);

    imageUris.forEach((imageUri, index) => {
      formData.append("images", {
        uri: imageUri,
        type: "image/jpeg",
        name: `batch_evidence_${index}_${Date.now()}.jpg`,
      } as any);
    });

    return apiAction.patchFormData<IDeliveryAssignmentEntity[]>(
      `${ApiEndpoints.DeliveryAssignmentsBatchStatusUnified}`,
      formData,
    );
  }

  const payload: Record<string, unknown> = { ids, status };
  if (note) payload.note = note;
  if (amountPaid !== undefined) payload.amountPaid = amountPaid;
  if (paymentMethodId !== undefined) payload.paymentMethodId = paymentMethodId;
  if (additionalAmount !== undefined)
    payload.additionalAmount = additionalAmount;
  if (gpsReadings?.length) payload.gpsReadings = gpsReadings;
  if (verificationCode) payload.verificationCode = verificationCode;
  if (scheduledAt) payload.scheduledAt = scheduledAt;

  return apiAction.patch<IDeliveryAssignmentEntity[]>(
    `${ApiEndpoints.DeliveryAssignmentsBatchStatusUnified}`,
    payload,
  );
};

export const getOptimizedRoute = (
  courierId: number,
  currentLocation: { lat: number; lng: number },
): Promise<any> =>
  apiAction.post<any>(
    `${ApiEndpoints.DeliveryAssignmentsOptimizedRoute}`.replace('{courierId}', String(courierId)),
    { currentLocation },
  );
