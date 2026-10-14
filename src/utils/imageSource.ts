import * as ImagePicker from "expo-image-picker";
import { Alert } from "@/components/AppAlert";

export type ImageSource = "camera" | "library";

export function chooseImageSource(onSelect: (source: ImageSource) => void) {
  Alert.alert("Thêm ảnh", "Chọn nguồn ảnh", [
    { text: "Chụp ảnh", onPress: () => onSelect("camera") },
    { text: "Chọn từ thư viện", onPress: () => onSelect("library") },
    { text: "Hủy", style: "cancel" },
  ]);
}

export async function pickImages(source: ImageSource, options: ImagePicker.ImagePickerOptions) {
  if (source === "camera") {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error("Vui lòng cấp quyền camera để thêm ảnh.");
  }
  return source === "camera"
    ? ImagePicker.launchCameraAsync({ ...options, allowsMultipleSelection: false, selectionLimit: 1 })
    : ImagePicker.launchImageLibraryAsync({ ...options, videoExportPreset: ImagePicker.VideoExportPreset.MediumQuality });
}
