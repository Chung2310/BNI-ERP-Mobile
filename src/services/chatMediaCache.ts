import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

const localImages = new Map<string, string>();
const mediaDimensions = new Map<string, { width: number; height: number }>();

export async function cachePickedChatImage(uri: string, mimeType?: string): Promise<string> {
  if (Platform.OS === 'web') return uri;
  const extension = mimeType?.split('/')[1]?.toLowerCase().replace('jpeg', 'jpg');
  const safeExtension = extension && /^[a-z0-9]{2,5}$/.test(extension) ? extension : 'jpg';
  const destination = new File(Paths.cache, `chat-image-${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExtension}`);
  try {
    await new File(uri).copy(destination);
    return destination.uri;
  } catch {
    return uri;
  }
}

export function rememberChatMedia(remoteUrl: string, localUri: string, dimensions?: { width?: number; height?: number }) {
  localImages.set(remoteUrl, localUri);
  if (dimensions?.width && dimensions.height) mediaDimensions.set(remoteUrl, { width: dimensions.width, height: dimensions.height });
}

export function chatMediaDimensions(remoteUrl: string) {
  return mediaDimensions.get(remoteUrl);
}

export function chatMediaUri(remoteUrl: string) {
  const localUri = localImages.get(remoteUrl);
  if (!localUri || Platform.OS === 'web') return remoteUrl;
  return new File(localUri).exists ? localUri : remoteUrl;
}
