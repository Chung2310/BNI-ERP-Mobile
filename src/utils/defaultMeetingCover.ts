import { meetingService } from "@/services/meeting";
import { generatedMeetingCoverBase64 } from "@/utils/generatedMeetingCover";

// The preview and uploaded cover use the same app-generated PNG.
export const defaultMeetingCoverSource = {
  uri: `data:image/png;base64,${generatedMeetingCoverBase64}`,
  width: 480,
  height: 192,
};

let defaultCoverUpload: Promise<string> | null = null;

export function uploadDefaultMeetingCover() {
  if (!defaultCoverUpload) {
    defaultCoverUpload = meetingService.uploadCover(generatedMeetingCoverBase64, "image/png")
      .catch((error) => {
        defaultCoverUpload = null;
        throw error;
      });
  }
  return defaultCoverUpload;
}

export async function resolveMeetingCoverForCreate(selectedCover: string) {
  if (selectedCover) return selectedCover;
  try {
    return await uploadDefaultMeetingCover();
  } catch {
    // Cover artwork is optional; a failed image upload must not block the meeting.
    return "";
  }
}
