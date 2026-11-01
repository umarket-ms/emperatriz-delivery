import React, { useEffect, useState } from "react";
import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { streamService } from "@/services/eventStreamService";
import { CustomColors } from "@/constants/CustomColors";

const RealtimeStatusIndicator: React.FC = () => {
  const [connected, setConnected] = useState(streamService.isConnected());

  useEffect(() => {
    const handler = (isConnected: boolean) => setConnected(isConnected);
    streamService.onConnectionChange(handler);
    return () => streamService.offConnectionChange(handler);
  }, []);

  const iconName = connected ? "wifi" : "cloud-offline";

  return (
    <Pressable
      style={{
        position: "absolute",
        top: 16,
        left: 16,
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: CustomColors.textLight,
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0px 2px 4px rgba(17,24,39,0.35)",
        zIndex: 10,
      }}
      onPress={() => {
        if (!connected) streamService.connect();
      }}
    >
      <Ionicons
        name={iconName as any}
        size={22}
        color={connected ? CustomColors.success : CustomColors.error}
      />
    </Pressable>
  );
};

RealtimeStatusIndicator.displayName = "RealtimeStatusIndicator";
export default React.memo(RealtimeStatusIndicator);
