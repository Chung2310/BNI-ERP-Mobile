import { Platform } from "react-native";

export const colors = {
  primary: "#00AECA",
  primaryDark: "#007F98",
  primarySoft: "#E4F8FB",
  background: "#F7FAFB",
  surface: "#FFFFFF",
  text: "#102533",
  muted: "#6D7F89",
  border: "#D9E3E8",
  danger: "#D9485F",
  warning: "#D99020",
  success: "#15966A",
  overlay: "rgba(16, 37, 51, 0.44)",
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const;
export const touchTarget = Platform.OS === "ios" ? 44 : 48;

export const shadow = Platform.select({
  ios: {
    shadowColor: "#102533",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  android: { elevation: 2 },
  default: {},
});
