import React, { useEffect, useRef } from 'react';
import {
  FlatList,
  StyleSheet,
  RefreshControl,
  StyleProp,
  ViewStyle,
  Animated,
  View,
  Text,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import AnimatedReanimated, { useSharedValue, useAnimatedStyle, withTiming, withDelay } from 'react-native-reanimated';
import { Swipeable, RectButton } from 'react-native-gesture-handler';
import { FontAwesome } from '@expo/vector-icons';
import { HistorialItem } from './HistorialItem';
import { CustomColors } from '@/constants/CustomColors';
import { DeliveryItemAdapter } from '@/interfaces/delivery/deliveryAdapters';
import { openWhatsAppMessage } from '@/utils/whatsapp';

const AnimatedRow = ({ children, index }: { children: React.ReactNode; index: number }) => {
  const fadeAnim = useSharedValue(0);
  const slideAnim = useSharedValue(30);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
    transform: [{ translateY: slideAnim.value }],
  }));

  useEffect(() => {
    fadeAnim.value = withDelay(index * 60, withTiming(1, { duration: 500 }));
    slideAnim.value = withDelay(index * 60, withTiming(0, { duration: 500 }));
  }, []);

  return (
    <AnimatedReanimated.View style={animatedStyle}>
      {children}
    </AnimatedReanimated.View>
  );
};

interface HistorialListProps {
  data: DeliveryItemAdapter[];
  loading?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
}

const actionButtonWidth = 110;

function formatPhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

function getKeyExtractor(item: DeliveryItemAdapter): string {
  return item.id;
}

export const HistorialList: React.FC<HistorialListProps> = ({
  data,
  loading = false,
  refreshing = false,
  onRefresh,
  contentContainerStyle,
  style,
}) => {
  const openSwipeableRef = useRef<Swipeable | null>(null);
  const rowSwipeablesRef = useRef<Map<string, Swipeable | null>>(null);
  if (rowSwipeablesRef.current === null) rowSwipeablesRef.current = new Map();
  const rowSwipeables = rowSwipeablesRef as React.MutableRefObject<Map<string, Swipeable | null>>;

  const closeOpenRow = () => {
    if (openSwipeableRef.current) {
      openSwipeableRef.current.close();
      openSwipeableRef.current = null;
    }
  };

  const handleWhatsApp = async (item: DeliveryItemAdapter) => {
    const phone = item.phone;
    if (!phone) {
      Alert.alert('WhatsApp', 'El número de teléfono no está disponible.');
      return;
    }

    const success = await openWhatsAppMessage(formatPhone(phone));
    if (!success) Alert.alert('WhatsApp', 'No se pudo abrir WhatsApp.');
    closeOpenRow();
  };

  const handleCall = (item: DeliveryItemAdapter) => {
    const phone = item.phone;
    if (!phone) {
      Alert.alert('Llamada', 'El número de teléfono no está disponible.');
      return;
    }

    const phoneNumber = formatPhone(phone);
    Linking.openURL(`tel:${phoneNumber}`);
    closeOpenRow();
  };

  const buildRightActions = (
    item: DeliveryItemAdapter,
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const translateX = dragX.interpolate({ inputRange: [-100, 0], outputRange: [0, 20], extrapolate: 'clamp' });
    const opacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1], extrapolate: 'clamp' });

    return (
      <Animated.View style={[styles.rightActions, { opacity, transform: [{ translateX }] }]}>
        <RectButton
          style={[styles.swipeActionButton, styles.whatsappAction]}
          onPress={() => handleWhatsApp(item)}
        >
          <FontAwesome name="whatsapp" size={20} color={CustomColors.textLight} style={styles.actionIcon} />
          <Text style={styles.actionText}>WhatsApp</Text>
        </RectButton>

        <RectButton
          style={[styles.swipeActionButton, styles.callAction]}
          onPress={() => handleCall(item)}
        >
          <FontAwesome name="phone" size={20} color={CustomColors.textLight} style={styles.actionIcon} />
          <Text style={styles.actionText}>Llamar</Text>
        </RectButton>
      </Animated.View>
    );
  };

  const renderItem = ({ item, index }: { item: DeliveryItemAdapter; index: number }) => {
    return (
      <AnimatedRow index={index}>
        <Swipeable
          ref={(ref) => {
            if (ref) {
              rowSwipeables.current.set(item.id, ref);
            } else {
              rowSwipeables.current.delete(item.id);
            }
          }}
          friction={2}
          leftThreshold={40}
          rightThreshold={40}
          onSwipeableWillOpen={() => {
            const current = rowSwipeables.current.get(item.id);
            if (openSwipeableRef.current && openSwipeableRef.current !== current) {
              openSwipeableRef.current.close();
            }
            openSwipeableRef.current = current || null;
          }}
          onSwipeableClose={() => {
            if (openSwipeableRef.current === rowSwipeables.current.get(item.id)) {
              openSwipeableRef.current = null;
            }
          }}
          renderRightActions={(progress, dragX) => buildRightActions(item, progress, dragX)}
        >
          <HistorialItem item={item} />
        </Swipeable>
      </AnimatedRow>
    );
  };

  if (loading && data.length === 0) {
    return (
      <View style={[styles.list, { justifyContent: 'center', alignItems: 'center' }, style] as any}>
        <ActivityIndicator size="large" color={CustomColors.secondary} />
      </View>
    );
  }

  return (
    <FlatList
      data={data}
      renderItem={renderItem}
      keyExtractor={getKeyExtractor}
      style={[styles.list, style]}
      contentContainerStyle={contentContainerStyle}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No hay viajes completados</Text>
        </View>
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[CustomColors.secondary]}
          tintColor={CustomColors.secondary}
          progressBackgroundColor={CustomColors.backgroundDark}
        />
      }
    />
  );
};

const styles = StyleSheet.create({
  list: {
    width: '100%',
    paddingTop: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40,
  },
  emptyText: {
    color: CustomColors.textLight,
    fontSize: 16,
    opacity: 0.6,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'flex-end',
    height: '93%',
    paddingHorizontal: 8,
  },
  swipeActionButton: {
    width: actionButtonWidth,
    height: '93%',
    paddingVertical: 0,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 6,
    boxShadow: '0px 2px 3px rgba(0,0,0,0.18)',
  },
  whatsappAction: {
    backgroundColor: '#25D366',
  },
  callAction: {
    backgroundColor: CustomColors.error,
  },
  actionText: {
    color: CustomColors.textLight,
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '700',
  },
  actionIcon: {
    marginBottom: 4,
  },
});
