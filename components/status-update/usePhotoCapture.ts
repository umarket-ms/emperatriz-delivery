import { useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";

export function usePhotoCapture() {
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);

  const takePhoto = async () => {
    try {
      const permissionResult =
        await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert("Permiso denegado", "Se requiere permiso de cámara.", [
          { text: "OK" },
        ]);
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0])
        setPhotoUri(result.assets[0].uri);
    } catch (error) {
      console.error("Error al tomar foto:", error);
      Alert.alert(
        "Error",
        "No se pudo abrir la cámara. Intenta de nuevo.",
      );
    }
  };

  const selectImageFromGallery = async () => {
    try {
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert("Permiso denegado", "Se requiere acceso a la galería.", [
          { text: "OK" },
        ]);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0])
        setImageUri(result.assets[0].uri);
    } catch (error) {
      console.error("Error al seleccionar imagen:", error);
      Alert.alert(
        "Error",
        "No se pudo abrir la galería. Intenta de nuevo.",
      );
    }
  };

  const removePhoto = () => setPhotoUri(null);
  const removeImage = () => setImageUri(null);

  return {
    photoUri,
    imageUri,
    takePhoto,
    selectImageFromGallery,
    removePhoto,
    removeImage,
    setPhotoUri,
    setImageUri,
  };
}
