import { Asset } from "expo-asset";
import { File } from "expo-file-system";
import { Platform } from "react-native";
import { meetingService } from "@/services/meeting";

export const defaultMeetingCoverSource = require("../../assets/images/banner-meeting.png");

let defaultCoverUpload: Promise<string> | null = null;

async function readDefaultCoverBase64() {
  const [asset] = await Asset.loadAsync(defaultMeetingCoverSource);
  if (Platform.OS !== "web") {
    if (!asset.localUri) throw new Error("Không đọc được ảnh bìa mặc định.");
    return new File(asset.localUri).base64();
  }

  const response = await fetch(asset.uri);
  if (!response.ok) throw new Error("Không đọc được ảnh bìa mặc định.");
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(new Error("Không đọc được ảnh bìa mặc định."));
    reader.readAsDataURL(blob);
  });
}

export function uploadDefaultMeetingCover() {
  if (!defaultCoverUpload) {
    defaultCoverUpload = readDefaultCoverBase64()
      .then((base64) => meetingService.uploadCover(base64, "image/png"))
      .catch((error) => {
        defaultCoverUpload = null;
        throw error;
      });
  }
  return defaultCoverUpload;
}
