import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Linking, Platform } from "react-native";
import { apiConfig, getApiAccessToken } from "@/services/api";
import { mediaUrl } from "@/utils/media";

type DownloadableFile = {
  url: string;
  name?: string;
  mimeType?: string;
};

function safeFileName(value?: string) {
  const trimmed = value?.trim().replace(/[\\/:*?"<>|]+/g, "-");
  return trimmed || `igen-download-${Date.now()}`;
}

export async function downloadAndOpenFile(file: DownloadableFile) {
  const downloadUrl = mediaUrl(file.url);
  if (!downloadUrl) throw new Error("Tệp này chưa có đường dẫn tải xuống.");

  if (Platform.OS === "web") {
    await Linking.openURL(downloadUrl);
    return;
  }
  if (!FileSystem.cacheDirectory) {
    throw new Error("Không thể truy cập bộ nhớ tạm để tải tệp.");
  }

  const downloadDirectory = `${FileSystem.cacheDirectory}downloads/`;
  await FileSystem.makeDirectoryAsync(downloadDirectory, { intermediates: true });
  const destination = `${downloadDirectory}${Date.now()}-${safeFileName(file.name)}`;
  const token = getApiAccessToken();
  const sameApi = downloadUrl.startsWith(`${apiConfig.baseUrl}/`);
  const result = await FileSystem.downloadAsync(downloadUrl, destination, {
    headers: sameApi && token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (result.status < 200 || result.status >= 300) {
    await FileSystem.deleteAsync(destination, { idempotent: true }).catch(() => undefined);
    throw new Error(`Máy chủ trả về lỗi ${result.status} khi tải tệp.`);
  }
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Thiết bị không hỗ trợ lưu hoặc mở tệp đã tải.");
  }

  await Sharing.shareAsync(result.uri, {
    dialogTitle: `Lưu hoặc mở ${file.name || "tệp"}`,
    mimeType: file.mimeType || "application/octet-stream",
  });
}
