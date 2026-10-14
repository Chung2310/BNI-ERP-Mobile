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
  const permission = source === "camera"
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error(`Vui lòng cấp quyền ${source === "camera" ? "camera" : "thư viện ảnh"} để thêm ảnh.`);
  }
  return source === "camera"
    ? ImagePicker.launchCameraAsync({ ...options, allowsMultipleSelection: false, selectionLimit: 1 })
    : ImagePicker.launchImageLibraryAsync(options);
}
