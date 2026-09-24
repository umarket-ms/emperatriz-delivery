import React from "react";
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  Linking,
  Alert,
  Text,
  ScrollView,
} from "react-native";
import { Image } from "expo-image";
import { DeliveryItemAdapter } from "@/interfaces/delivery/deliveryAdapters";
import { AssignmentType } from "@/utils/enum";
import { CustomColors } from "@/constants/CustomColors";
import { Capitalize } from "@/utils/capitalize";
import { openWhatsAppMessage } from "@/utils/whatsapp";
import { PRODUCT_IMAGE_URL } from "@/services/api";

export interface AssignmentDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  assignment: DeliveryItemAdapter;
  allAssignments?: DeliveryItemAdapter[];
}

export default function AssignmentDetailsModal({
  visible,
  onClose,
  assignment,
  allAssignments,
}: AssignmentDetailsModalProps) {
  const handleWhatsApp = async () => {
    if (!assignment.phone) return;
    const success = await openWhatsAppMessage(assignment.phone);
    if (!success) Alert.alert("WhatsApp", "No se pudo abrir WhatsApp.");
  };

  const handleCall = () => {
    if (!assignment.phone) return;
    Linking.openURL(`tel:${assignment.phone}`);
  };

  // For PICKUP assignments, get product details from the DELIVERY assignment of the same shipment
  const getDetailsWithImages = () => {
    if (assignment.deliveryAssignmentDetails && 
        assignment.deliveryAssignmentDetails.filter(d => d.type === 'PRODUCT').length > 0) {
      return assignment.deliveryAssignmentDetails;
    }
    // If this is a PICKUP, look for the DELIVERY assignment with the same shipmentId
    if (assignment.type === AssignmentType.PICKUP && allAssignments) {
      const deliveryAssignment = allAssignments.find(
        (a) => a.type === AssignmentType.DELIVERY && a.shipmentId === assignment.shipmentId
      );
      if (deliveryAssignment?.deliveryAssignmentDetails) {
        return deliveryAssignment.deliveryAssignmentDetails;
      }
    }
    return assignment.deliveryAssignmentDetails;
  };

  const detailsWithImages = getDetailsWithImages();
  const fullAddress = assignment.deliveryAddress || "";
  const siteType = assignment.type === AssignmentType.PICKUP ? 'RECOGIDA' : 'ENTREGA';
      
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Detalles de ubicación</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          <View style={styles.content}>
            <View style={[styles.infoRow, { paddingVertical: 6, backgroundColor: CustomColors.backgroundDark, borderRadius: 10 }] }>
              <Text style={[styles.value, { color: CustomColors.primary, fontWeight: '800' }]}>{siteType}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Contacto:</Text>
              <Text style={styles.value}>{assignment.client}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Teléfono:</Text>
              <Text style={styles.value}>{assignment.phone || "Sin teléfono"}</Text>
            </View>
            <View style={[styles.infoRow, { justifyContent: 'flex-start', paddingVertical: 10 }] }>
              <Text style={[styles.value, { width: '100%', textAlign: 'left' }]}>{`${fullAddress || ''}`.trim() || 'Sin dirección'}</Text>
            </View>

            <View style={styles.actionsRow}>
              <Pressable
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }, styles.actionButton, styles.whatsappButton]}
                onPress={handleWhatsApp}
              >
                <Text style={styles.actionText}>WhatsApp</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }, styles.actionButton, styles.callButton]}
                onPress={handleCall}
              >
                <Text style={styles.actionText}>Llamar</Text>
              </Pressable>
            </View>

            {detailsWithImages &&
              detailsWithImages.filter(
                (detail) => detail.type === 'PRODUCT'
              ).length > 0 && (
                <View style={styles.productsSection}>
                  <Text style={styles.productsSectionTitle}>Productos</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.productsScrollContent}
                  >
                    {detailsWithImages
                      .filter((detail) => detail.type === 'PRODUCT')
                      .map((detail, idx) => {
                        const imageUrl = detail.imageUrl
                          ? `${PRODUCT_IMAGE_URL}${detail.imageUrl}`
                          : null;
                        return (
                          <View key={detail.id || idx} style={styles.productItem}>
                            {imageUrl ? (
                              <Image
                                source={{ uri: imageUrl }}
                                style={styles.productImage}
                                contentFit="cover"
                                defaultSource={require("@/assets/images/icon.png")}
                              />
                            ) : (
                              <View style={[styles.productImage, styles.productImagePlaceholder]}>
                                <Text style={styles.productPlaceholderText}>📦</Text>
                              </View>
                            )}
                            {detail.productTitle ? (
                              <Text style={styles.productTitle} numberOfLines={2}>
                                {Capitalize(detail.productTitle)}
                              </Text>
                            ) : null}
                          </View>
                        );
                      })}
                  </ScrollView>
                </View>
              )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: CustomColors.overlay,
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    width: "90%",
    backgroundColor: CustomColors.backgroundDark,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: CustomColors.border,
    maxHeight: "85%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    color: CustomColors.white,
    fontSize: 18,
    fontWeight: "700",
  },
  closeButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: CustomColors.primary,
  },
  closeText: {
    color: CustomColors.white,
    fontWeight: "700",
  },
  content: {
    gap: 12,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: CustomColors.backgroundMedium,
  },
  label: {
    color: CustomColors.neutralLight,
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  value: {
    color: CustomColors.white,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "right",
    flex: 1,
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  whatsappButton: {
    backgroundColor: '#25D366',
  },
  callButton: {
    backgroundColor: CustomColors.primary,
  },
  actionText: {
    color: CustomColors.white,
    fontWeight: "700",
  },
  productsSection: {
    borderTopWidth: 1,
    borderTopColor: CustomColors.border,
    paddingTop: 10,
  },
  productsSectionTitle: {
    color: CustomColors.neutralLight,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  productsScrollContent: {
    gap: 10,
    paddingHorizontal: 2,
    paddingBottom: 4,
  },
  productItem: {
    alignItems: "center",
    width: 72,
  },
  productImage: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: CustomColors.backgroundMedium,
    overflow: "hidden",
  },
  productImagePlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  productPlaceholderText: {
    fontSize: 28,
  },
  productTitle: {
    color: CustomColors.white,
    fontSize: 10,
    fontWeight: "500",
    textAlign: "center",
    marginTop: 4,
    width: 72,
  },
});
