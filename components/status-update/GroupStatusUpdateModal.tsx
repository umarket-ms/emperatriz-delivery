import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  ScrollView,
} from "react-native";
import { TimePickerModal } from "react-native-paper-dates";
import * as Location from "expo-location";
import { IGpsReading } from "@/interfaces/delivery/delivery";
import {
  getStatusColor,
  IDeliveryStatus,
  getStatusIdFromTitle,
} from "@/interfaces/delivery/deliveryStatus";
import { CustomColors } from "@/constants/CustomColors";
import {
  getDeliveries,
  updateDeliveryStatusBatch,
  updateDeliveryStatusUnified,
} from "@/core/actions/delivery.actions";
import { useDelivery } from "@/context/DeliveryContext";
import { useCurrency } from "@/core/hooks/useCurrency";
import {
  adaptDeliveriesToAdapter,
  DeliveryItemAdapter,
} from "@/interfaces/delivery/deliveryAdapters";
import { AssignmentType } from "@/utils/enum";
import { EvidenceSection } from "@/components/status-update/EvidenceSection";
import { NoteInput } from "@/components/status-update/NoteInput";
import { PaymentControls } from "@/components/status-update/PaymentControls";
import { StatusList } from "@/components/status-update/StatusList";
import { useEvidenceFlags } from "@/core/hooks/useEvidenceFlags";
import { usePaymentMethods } from "@/core/hooks/usePaymentMethods";
import { useStatusData } from "@/core/hooks/useStatusData";
import { Capitalize } from "@/utils/capitalize";
import { useVerificationCode } from "@/components/status-update/useVerificationCode";
import { usePhotoCapture } from "@/components/status-update/usePhotoCapture";

/** Rounds minutes to the nearest valid 30-minute interval (0 or 30). */
function roundToHalfHour(hours: number, minutes: number): { hours: number; minutes: number } {
  const rounded = Math.round(minutes / 30) * 30;
  if (rounded === 60) {
    return { hours: (hours + 1) % 24, minutes: 0 };
  }
  return { hours, minutes: rounded };
}

const STATUSES_REQUIRING_NOTE = [
  IDeliveryStatus.CANCELLED,
  IDeliveryStatus.RETURNED,
  IDeliveryStatus.ON_HOLD,
  IDeliveryStatus.SCHEDULED,
];

export interface GroupStatusUpdateModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (newStatus: string, freshDeliveries: DeliveryItemAdapter[]) => void;
  /** Numeric string IDs of every assignment in this group */
  ids: string[];
  assignmentType: AssignmentType;
  groupTitle: string;
  currentStatus: string;
  /** Sum of (deliveryCost + amountToBeCharged) across the group */
  totalAmount: number;
}

export default function GroupStatusUpdateModal({
  visible,
  onClose,
  onSuccess,
  ids,
  assignmentType,
  groupTitle,
  currentStatus,
  totalAmount,
}: GroupStatusUpdateModalProps) {
  const { deliveries, handleDriversGroupAssigned } = useDelivery();
  const { formatPrice } = useCurrency();

  const isPickupType = assignmentType === AssignmentType.PICKUP;

  const [selectedStatus, setSelectedStatusRaw] = useState<string | null>(null);
  const { availableStatuses, loadingStatuses } = useStatusData(currentStatus);
  const [loading, setLoading] = useState<boolean>(false);
  const [note, setNote] = useState<string>("");
  const [amountPaid, setAmountPaid] = useState<string>("");
  const amountPaidEditedRef = useRef<boolean>(false);
  const [additionalAmount, setAdditionalAmount] = useState<string>("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<
    number | null
  >(null);
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [showSchedulePicker, setShowSchedulePicker] = useState<boolean>(false);
  const { paymentMethods } = usePaymentMethods();
  const [showPaymentMethodPicker, setShowPaymentMethodPicker] =
    useState<boolean>(false);

  const {
    photoUri,
    imageUri,
    takePhoto,
    selectImageFromGallery,
    removePhoto,
    removeImage,
    setPhotoUri,
    setImageUri,
  } = usePhotoCapture();

  const isDelivered = selectedStatus === IDeliveryStatus.DELIVERED;
  const {
    verificationCode,
    codeVerificationStatus,
    isCodeLocked,
    lockTimeRemaining,
    failedAttempts,
    assignmentVerificationCode,
    handleVerificationCodeChange,
    resetVerificationCode,
  } = useVerificationCode(deliveries, ids, isDelivered);

  const handleSelectStatus = useCallback((newStatus: string | null) => {
    setSelectedStatusRaw(newStatus);
    const isNowDelivered = newStatus === IDeliveryStatus.DELIVERED;
    if (isPickupType && isNowDelivered) {
      setAmountPaid("0");
    } else if (isNowDelivered && !isPickupType && !amountPaidEditedRef.current) {
      setAmountPaid(String(totalAmount));
      if (totalAmount === 0) {
        const transferencia = paymentMethods.find(
          (pm) => pm.title?.toLowerCase() === "transferencia",
        );
        if (transferencia) setSelectedPaymentMethod(transferencia.id);
      }
    }
  }, [isPickupType, totalAmount, paymentMethods]);

  const currentHour = useMemo(() => new Date().getHours(), []);

  const isScheduled = selectedStatus === IDeliveryStatus.SCHEDULED;
  const requiresNote =
    selectedStatus &&
    STATUSES_REQUIRING_NOTE.includes(selectedStatus as IDeliveryStatus);
  const requiresPaymentInfo = isDelivered && !isPickupType;
  const requiresVerificationCode = isDelivered;

  const selectedPaymentTitle: string | null = selectedPaymentMethod
    ? (paymentMethods
        .find((pm) => pm.id === selectedPaymentMethod)
        ?.title?.toLowerCase() ?? null)
    : null;
  const isPaymentMethodDisabled =
    totalAmount === 0 && isDelivered && !isPickupType;

  const { requiresCameraPhoto, requiresGalleryImage, showEvidence } =
    useEvidenceFlags(
      selectedStatus,
      isPickupType,
      selectedPaymentTitle,
      amountPaid,
    );

  const isFormValid: boolean = !!(
    selectedStatus &&
    availableStatuses.length > 0 &&
    (!requiresNote || note.trim() !== "") &&
    (!requiresCameraPhoto || photoUri) &&
    (!requiresGalleryImage || imageUri) &&
    (!requiresPaymentInfo ||
      (amountPaid.trim() !== "" && selectedPaymentMethod)) &&
    (!requiresVerificationCode ||
      (verificationCode.trim().length === 4 && codeVerificationStatus === "valid")) &&
    (!isScheduled || scheduledAt !== null)
  );


  const handleClose = () => {
    setLoading(false);
    setScheduledAt(null);
    setShowSchedulePicker(false);
    resetVerificationCode();
    onClose();
  };

  const handleConfirm = async () => {
    if (!selectedStatus) return;

    if (requiresNote && note.trim() === "") {
      Alert.alert("Campo requerido", "Debes escribir una nota para este estado.", [{ text: "OK" }]);
      return;
    }
    if (!isPickupType && isDelivered && !photoUri && !imageUri) {
      Alert.alert("Evidencia requerida", "Debes tomar o seleccionar una foto.", [{ text: "OK" }]);
      return;
    }
    if (requiresPaymentInfo && !amountPaid.trim()) {
      Alert.alert("Monto requerido", "Debes ingresar el monto pagado.", [{ text: "OK" }]);
      return;
    }
    if (requiresPaymentInfo && !selectedPaymentMethod) {
      Alert.alert("Método de pago requerido", "Debes seleccionar un método de pago.", [{ text: "OK" }]);
      return;
    }
    if (requiresVerificationCode && verificationCode.trim().length !== 4) {
      Alert.alert(
        "Código requerido",
        "Debes ingresar el código de verificación de 4 dígitos para confirmar la entrega.",
        [{ text: "OK" }],
      );
      return;
    }
    if (isScheduled && !scheduledAt) {
      Alert.alert("Hora requerida", "Debes seleccionar la hora programada.", [{ text: "OK" }]);
      return;
    }
    if (requiresCameraPhoto && !photoUri) {
      Alert.alert("Evidencia requerida", "Debes tomar una foto con la cámara.", [{ text: "OK" }]);
      return;
    }
    if (requiresGalleryImage && !imageUri) {
      Alert.alert("Evidencia requerida", "Debes seleccionar una imagen de galería.", [{ text: "OK" }]);
      return;
    }

    const statusId = getStatusIdFromTitle(selectedStatus);
    if (!statusId) {
      Alert.alert("Error", "No se pudo obtener el ID del estado.", [{ text: "OK" }]);
      return;
    }

    setLoading(true);
    try {
      const STATUSES_REQUIRING_GPS = [
        IDeliveryStatus.IN_PROGRESS,
        IDeliveryStatus.DELIVERED,
        IDeliveryStatus.RETURNED,
      ];
      let gpsReadings: IGpsReading[] | undefined;
      if (STATUSES_REQUIRING_GPS.includes(selectedStatus as IDeliveryStatus)) {
        const { status: locStatus } =
          await Location.requestForegroundPermissionsAsync();
        if (locStatus === "granted") {
          const position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          gpsReadings = [
            {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy ?? 0,
              timestamp: position.timestamp,
              speed: position.coords.speed ?? undefined,
            },
          ];
        }
      }

      const evidenceUris: string[] = [];
      if (photoUri) evidenceUris.push(photoUri);
      if (imageUri) evidenceUris.push(imageUri);

      const commonNote = requiresNote ? note.trim() : undefined;
      const commonAmountPaid =
        requiresPaymentInfo && amountPaid.trim() ? parseFloat(amountPaid) : undefined;
      const commonPaymentMethodId =
        requiresPaymentInfo && selectedPaymentMethod ? selectedPaymentMethod : undefined;
      const commonAdditionalAmount =
        isPickupType && isDelivered && additionalAmount.trim()
          ? parseFloat(additionalAmount)
          : undefined;
      const commonImageUris = evidenceUris.length > 0 ? evidenceUris : undefined;
      const commonVerificationCode = requiresVerificationCode && verificationCode.trim()
        ? verificationCode.trim()
        : undefined;
      const commonScheduledAt = isScheduled && scheduledAt ? scheduledAt.toISOString() : undefined;

      let freshDeliveries: DeliveryItemAdapter[];

      if (ids.length === 1) {
        await updateDeliveryStatusUnified({
          id: ids[0],
          status: statusId,
          note: commonNote,
          amountPaid: commonAmountPaid,
          paymentMethodId: commonPaymentMethodId,
          additionalAmount: commonAdditionalAmount,
          gpsReadings,
          imageUris: commonImageUris,
          verificationCode: commonVerificationCode,
          scheduledAt: commonScheduledAt,
        });
        // Fetch the updated active list after single update
        freshDeliveries = await getDeliveries();
      } else {
        const numericIds = ids.map((id) => Number(id));
        const rawFresh = await updateDeliveryStatusBatch(
          numericIds,
          statusId,
          commonNote,
          commonAmountPaid,
          commonPaymentMethodId,
          commonAdditionalAmount,
          gpsReadings,
          commonImageUris,
          commonVerificationCode,
          commonScheduledAt,
        );
        // Batch endpoint now returns the findByDriver result directly
        freshDeliveries = adaptDeliveriesToAdapter(rawFresh);
      }

      // Update the DeliveryContext with the fresh list
      handleDriversGroupAssigned(freshDeliveries);

      // Reset all fields
      setSelectedStatusRaw(null);
      setNote("");
      setPhotoUri(null);
      setImageUri(null);
      setAmountPaid("");
      amountPaidEditedRef.current = false;
      setAdditionalAmount("");
      setSelectedPaymentMethod(null);
      resetVerificationCode();
      setScheduledAt(null);
      setShowSchedulePicker(false);

      onSuccess?.(selectedStatus, freshDeliveries);
      onClose();
    } catch (error:any) {
      Alert.alert(
        "Error",
        `Ocurrio un error: ${error instanceof Error ? error.message : "Error desconocido"}`,
        [{ text: "OK" }],
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Actualizar Estado</Text>
            <Text style={styles.deliveryTitle}>
              {groupTitle}
              {!isPickupType ? ` · Total: ${formatPrice(totalAmount)}` : ""}
            </Text>
            <Text style={styles.currentStatus}>
              Estado actual:{" "}
              <Text
                style={[
                  styles.statusValue,
                  { color: getStatusColor(currentStatus) },
                ]}
              >
                {Capitalize(currentStatus)}
              </Text>
            </Text>
          </View>

          <ScrollView style={styles.scrollContent}>
            <StatusList
              availableStatuses={availableStatuses as any}
              selectedStatus={selectedStatus}
              onSelectStatus={handleSelectStatus}
              loadingStatuses={loadingStatuses}
              styles={styles}
            />

            {isScheduled && (
              <View style={styles.paymentContainer}>
                <Text style={styles.paymentLabel}>Hora programada (obligatoria):</Text>
                <Pressable
                  style={styles.paymentInput}
                  onPress={() => setShowSchedulePicker(true)}
                >
                  <Text style={{ color: scheduledAt ? CustomColors.textLight : CustomColors.divider }}>
                    {scheduledAt
                      ? scheduledAt.toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' })
                      : 'Seleccionar hora...'}
                  </Text>
                </Pressable>
              </View>
            )}

            {requiresNote && (
              <NoteInput value={note} onChange={setNote} styles={styles} />
            )}

            {isDelivered && !isPickupType && (
              <PaymentControls
                selectedPaymentMethod={selectedPaymentMethod}
                paymentMethods={paymentMethods}
                showPicker={showPaymentMethodPicker}
                setShowPicker={setShowPaymentMethodPicker}
                onSelect={setSelectedPaymentMethod}
                styles={styles}
                disabled={isPaymentMethodDisabled}
              />
            )}

            <EvidenceSection
              showEvidence={showEvidence}
              requiresCameraPhoto={requiresCameraPhoto}
              requiresGalleryImage={requiresGalleryImage}
              photoUri={photoUri}
              imageUri={imageUri}
              takePhoto={takePhoto}
              selectImageFromGallery={selectImageFromGallery}
              removePhoto={removePhoto}
              removeImage={removeImage}
              styles={styles}
            />

            {isDelivered && !isPickupType && (
              <View style={styles.paymentContainer}>
                <Text style={styles.paymentLabel}>Monto Pagado (Obligatorio):</Text>
                <TextInput
                  style={styles.paymentInput}
                  placeholder="Ingrese el monto pagado..."
                  placeholderTextColor={CustomColors.divider}
                  value={amountPaid}
                  editable={false}
                  selectTextOnFocus={false}
                />
              </View>
            )}

            {isDelivered && isPickupType && (
              <View style={styles.paymentContainer}>
                <Text style={styles.paymentLabel}>Monto Adicional (Opcional):</Text>
                <TextInput
                  style={styles.paymentInput}
                  placeholder="Ingrese el monto adicional..."
                  placeholderTextColor={CustomColors.divider}
                  value={additionalAmount}
                  onChangeText={setAdditionalAmount}
                  keyboardType="numeric"
                />
              </View>
            )}

            {isDelivered && (
              <VerificationCodeSection
                verificationCode={verificationCode}
                codeVerificationStatus={codeVerificationStatus}
                isCodeLocked={isCodeLocked}
                lockTimeRemaining={lockTimeRemaining}
                failedAttempts={failedAttempts}
                assignmentVerificationCode={assignmentVerificationCode}
                onChange={handleVerificationCodeChange}
              />
            )}
          </ScrollView>

          <ModalFooter
            onCancel={handleClose}
            onConfirm={handleConfirm}
            isValid={isFormValid}
            loading={loading}
          />
        </View>
      </View>

      {/* Time picker modal for SCHEDULED status */}
      <TimePickerModal
        visible={showSchedulePicker}
        onDismiss={() => setShowSchedulePicker(false)}
        onConfirm={({ hours, minutes }) => {
          const rounded = roundToHalfHour(hours, minutes);
          const date = new Date();
          date.setHours(rounded.hours, rounded.minutes, 0, 0);
          // If the rounded time has already passed today, schedule for tomorrow
          if (date <= new Date()) {
            date.setDate(date.getDate() + 1);
          }
          setScheduledAt(date);
          setShowSchedulePicker(false);
        }}
        hours={scheduledAt ? scheduledAt.getHours() : currentHour}
        minutes={scheduledAt ? scheduledAt.getMinutes() : 0}
        label="Hora programada"
        locale="es"
        use24HourClock
      />
    </Modal>
  );
}

interface VerificationCodeSectionProps {
  verificationCode: string;
  codeVerificationStatus: "pending" | "valid" | "invalid";
  isCodeLocked: boolean;
  lockTimeRemaining: number;
  failedAttempts: number;
  assignmentVerificationCode: string | null | undefined;
  onChange: (text: string) => void;
}

function VerificationCodeSection({
  verificationCode,
  codeVerificationStatus,
  isCodeLocked,
  lockTimeRemaining,
  failedAttempts,
  assignmentVerificationCode,
  onChange,
}: VerificationCodeSectionProps) {
  return (
    <View style={styles.paymentContainer}>
      <View style={styles.codeVerificationLabelRow}>
        <View style={styles.labelContainer}>
          <Text style={styles.paymentLabel}>Código (Obligatorio):</Text>
          {__DEV__ && assignmentVerificationCode ? (
            <Text style={styles.devCodeHint}>{assignmentVerificationCode}</Text>
          ) : null}
        </View>
        {codeVerificationStatus === "valid" && <Text style={styles.checkIcon}>✓</Text>}
        {codeVerificationStatus === "invalid" && verificationCode.length === 4 && <Text style={styles.errorIcon}>✕</Text>}
      </View>
      {isCodeLocked ? (
        <View style={styles.lockedCodeContainer}>
          <Text style={styles.lockedCodeText}>Demasiados intentos. Intenta en {lockTimeRemaining}s</Text>
        </View>
      ) : (
        <>
          <TextInput
            style={[
              styles.paymentInput,
              codeVerificationStatus === "invalid" && verificationCode.length === 4 && styles.inputError,
              codeVerificationStatus === "valid" && styles.inputSuccess,
            ]}
            placeholder="Ingresar código..."
            placeholderTextColor={CustomColors.divider}
            value={verificationCode}
            onChangeText={onChange}
            keyboardType="numeric"
            maxLength={4}
            returnKeyType="done"
            editable={!isCodeLocked}
          />
          {codeVerificationStatus === "invalid" && verificationCode.length === 4 && (
            <Text style={styles.errorMessage}>Código incorrecto. Intentos restantes: {3 - failedAttempts}</Text>
          )}
        </>
      )}
    </View>
  );
}

interface ModalFooterProps {
  onCancel: () => void;
  onConfirm: () => void;
  isValid: boolean;
  loading: boolean;
}

function ModalFooter({ onCancel, onConfirm, isValid, loading }: ModalFooterProps) {
  return (
    <View style={styles.buttonContainer}>
      <Pressable style={[styles.button, styles.cancelButton]} onPress={onCancel} disabled={loading}>
        <Text style={styles.buttonText}>Cancelar</Text>
      </Pressable>
      <Pressable
        style={[styles.button, styles.confirmButton, (!isValid || loading) && styles.disabledButton]}
        onPress={onConfirm}
        disabled={!isValid || loading}
      >
        {loading ? <ActivityIndicator size="small" color={CustomColors.textLight} /> : <Text style={styles.buttonText}>Guardar</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: CustomColors.overlay,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: CustomColors.backgroundDark,
    borderRadius: 10,
    padding: 20,
    width: "90%",
    maxWidth: 500,
    maxHeight: "90%",
  },
  modalHeader: {
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: CustomColors.textLight,
    marginBottom: 10,
    textAlign: "center",
  },
  deliveryTitle: {
    fontSize: 16,
    color: CustomColors.textLight,
    textAlign: "center",
    marginBottom: 5,
  },
  currentStatus: {
    fontSize: 16,
    color: CustomColors.textLight,
    textAlign: "center",
    marginBottom: 5,
  },
  statusValue: {
    fontWeight: "bold",
  },
  statusList: {
    marginBottom: 10,
  },
  statusItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    backgroundColor: CustomColors.cardBackground,
    marginBottom: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CustomColors.divider,
  },
  skeletonItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    backgroundColor: CustomColors.cardBackground,
    marginBottom: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CustomColors.divider,
  },
  skeletonRadio: {
    height: 24,
    width: 24,
    borderRadius: 12,
    backgroundColor: CustomColors.divider,
    marginRight: 12,
  },
  skeletonText: {
    flex: 1,
    height: 16,
    borderRadius: 4,
    backgroundColor: CustomColors.divider,
  },
  skeletonIndicator: {
    height: 8,
    width: 40,
    borderRadius: 4,
    backgroundColor: CustomColors.divider,
    marginLeft: 12,
  },
  radioButton: {
    height: 24,
    width: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: CustomColors.textLight,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  radioButtonSelected: {
    height: 12,
    width: 12,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 16,
    color: CustomColors.textLight,
    flex: 1,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: 10,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: CustomColors.backgroundDarkest,
    marginRight: 10,
  },
  confirmButton: {
    backgroundColor: CustomColors.secondary,
    marginLeft: 10,
  },
  disabledButton: {
    backgroundColor: CustomColors.divider,
    opacity: 0.7,
  },
  buttonText: {
    color: CustomColors.textLight,
    fontWeight: "bold",
    fontSize: 16,
  },
  noStatusesContainer: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: CustomColors.backgroundDarkest,
    borderRadius: 8,
    marginBottom: 20,
  },
  noStatusesText: {
    color: CustomColors.textLight,
    textAlign: "center",
    fontSize: 16,
    opacity: 0.7,
  },
  noteContainer: {
    marginBottom: 20,
  },
  noteLabel: {
    fontSize: 16,
    color: CustomColors.textLight,
    marginBottom: 8,
    fontWeight: "bold",
  },
  noteInput: {
    backgroundColor: CustomColors.backgroundDarkest,
    borderRadius: 8,
    padding: 12,
    color: CustomColors.textLight,
    fontSize: 16,
    borderWidth: 1,
    borderColor: CustomColors.divider,
    minHeight: 80,
    maxHeight: 120,
  },
  characterCount: {
    fontSize: 12,
    color: CustomColors.textLight,
    opacity: 0.6,
    textAlign: "right",
    marginTop: 4,
  },
  photoContainer: {
    marginBottom: 20,
  },
  photoLabel: {
    fontSize: 16,
    color: CustomColors.textLight,
    fontWeight: "bold",
    marginBottom: 5,
  },
  photoButton: {
    backgroundColor: CustomColors.backgroundDarkest,
    borderRadius: 8,
    padding: 15,
    borderWidth: 1,
    borderColor: CustomColors.divider,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 5,
  },
  photoButtonText: {
    color: CustomColors.textLight,
    fontSize: 16,
    fontWeight: "bold",
  },
  imagesRowContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  imageHalfContainer: {
    flex: 0.48,
  },
  singleImageContainer: {},
  imageTypeLabel: {
    fontSize: 14,
    color: CustomColors.textLight,
    marginBottom: 5,
    fontWeight: "600",
  },
  photoPreviewContainer: {
    position: "relative",
    alignItems: "center",
  },
  photoPreview: {
    width: 150,
    height: 112,
    borderRadius: 8,
  },
  photoPreviewHalf: {
    width: "100%",
    height: 100,
    borderRadius: 8,
  },
  removePhotoButton: {
    position: "absolute",
    top: 5,
    right: 5,
    backgroundColor: CustomColors.error,
    borderRadius: 15,
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  removePhotoText: {
    color: CustomColors.textLight,
    fontSize: 16,
    fontWeight: "bold",
  },
  imagePlaceholderContainer: {
    alignItems: "center",
  },
  imagePlaceholder: {
    width: "100%",
    height: 100,
    borderRadius: 8,
    backgroundColor: CustomColors.backgroundDarkest,
    borderWidth: 2,
    borderColor: CustomColors.divider,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  placeholderIcon: {
    fontSize: 24,
    color: CustomColors.textLight,
    opacity: 0.6,
    marginBottom: 4,
  },
  placeholderText: {
    fontSize: 12,
    color: CustomColors.textLight,
    opacity: 0.6,
    textAlign: "center",
  },
  placeholderButton: {
    backgroundColor: CustomColors.secondary,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    width: "100%",
    alignItems: "center",
  },
  placeholderButtonText: {
    color: CustomColors.textLight,
    fontSize: 12,
    fontWeight: "bold",
  },
  paymentContainer: {
    marginBottom: 10,
  },
  paymentLabel: {
    fontSize: 16,
    color: CustomColors.textLight,
    fontWeight: "bold",
  },
  paymentInput: {
    backgroundColor: CustomColors.backgroundDarkest,
    borderRadius: 8,
    padding: 12,
    color: CustomColors.textLight,
    fontSize: 16,
    borderWidth: 1,
    borderColor: CustomColors.divider,
    height: 50,
  },
  paymentMethodButton: {
    backgroundColor: CustomColors.backgroundDarkest,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: CustomColors.divider,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    height: 50,
  },
  paymentMethodButtonText: {
    color: CustomColors.textLight,
    fontSize: 16,
    flex: 1,
  },
  dropdownArrow: {
    color: CustomColors.textLight,
    fontSize: 12,
  },
  codeVerificationLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  labelContainer: {
    flex: 1,
  },
  checkIcon: {
    fontSize: 24,
    color: CustomColors.success,
    fontWeight: "bold",
    marginLeft: 10,
  },
  errorIcon: {
    fontSize: 24,
    color: CustomColors.error,
    fontWeight: "bold",
    marginLeft: 10,
  },
  inputSuccess: {
    borderColor: CustomColors.success,
    borderWidth: 2,
  },
  lockedCodeContainer: {
    backgroundColor: `${CustomColors.error}1A`,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: CustomColors.error,
    alignItems: "center",
  },
  lockedCodeText: {
    color: CustomColors.error,
    fontSize: 16,
    fontWeight: "bold",
  },
  inputError: {
    borderColor: CustomColors.error,
    borderWidth: 2,
  },
  errorMessage: {
    color: CustomColors.error,
    fontSize: 12,
    marginTop: 4,
  },
  devCodeHint: {
    fontSize: 12,
    color: CustomColors.warning,
    fontWeight: "bold",
    marginTop: 2,
  },
});
