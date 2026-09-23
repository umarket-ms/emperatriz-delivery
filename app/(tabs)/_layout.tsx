import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';

import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { CustomColors } from '@/constants/CustomColors';
import { RouteProvider } from '@/contexts/RouteContext';

// You can explore the built-in icon families and icons on the web at https://icons.expo.fyi/
function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={24} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  return (
    <RouteProvider>
    <Tabs
      initialRouteName="trip-map"
      screenOptions={{
        tabBarActiveTintColor: CustomColors.primary,
        tabBarInactiveTintColor: CustomColors.neutralLight,
        tabBarStyle: {
          backgroundColor: CustomColors.tabBarBackground,
          borderTopColor: CustomColors.border,
          height: 64,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarLabelStyle: {
          fontWeight: '600',
          fontSize: 11,
        },
        headerShown: useClientOnlyValue(false, true),
      }}>
      <Tabs.Screen
        name="trip-map"
        options={{
          title: 'Ruta',
          tabBarIcon: ({ color }) => <TabBarIcon name="map" color={color} />,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="historial"
        options={{
          title: 'Historial',
          tabBarIcon: ({ color }) => <TabBarIcon name="history" color={color} />,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="two"
        options={{
          title: 'Ajustes',
          tabBarIcon: ({ color }) => <TabBarIcon name="gear" color={color} />,
          headerShown: false,
        }}
      />
    </Tabs>
    </RouteProvider>
  );
}
