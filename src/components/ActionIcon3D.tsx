import { StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Rect, Path, Circle } from "react-native-svg";
import type { LucideIcon } from "lucide-react-native";

export type ActionIcon3DType =
  | "checkin"
  | "create"
  | "fees"
  | "rankings"
  | "resources"
  | "org"
  | "notifications"
  | "settings"
  | "users"
  | "roles";

interface ActionTheme {
  primary: string;
  secondary: string;
  highlight: string;
  shadow: string;
}

const actionThemes: Record<ActionIcon3DType, ActionTheme> = {
  checkin: {
    primary: "#00C48C",
    secondary: "#007A55",
    highlight: "#79F2C7",
    shadow: "#00C48C",
  },
  create: {
    primary: "#00AECA",
    secondary: "#007285",
    highlight: "#68E4F8",
    shadow: "#00AECA",
  },
  fees: {
    primary: "#FFB020",
    secondary: "#C77700",
    highlight: "#FFE28A",
    shadow: "#FFB020",
  },
  rankings: {
    primary: "#FF7849",
    secondary: "#C43800",
    highlight: "#FFAA8A",
    shadow: "#FF7849",
  },
  resources: {
    primary: "#2563EB",
    secondary: "#1D4ED8",
    highlight: "#93C5FD",
    shadow: "#2563EB",
  },
  org: {
    primary: "#8B5CF6",
    secondary: "#6D28D9",
    highlight: "#C4B5FD",
    shadow: "#8B5CF6",
  },
  notifications: {
    primary: "#EC4899",
    secondary: "#BE185D",
    highlight: "#FBCFE8",
    shadow: "#EC4899",
  },
  settings: {
    primary: "#64748B",
    secondary: "#334155",
    highlight: "#CBD5E1",
    shadow: "#64748B",
  },
  users: {
    primary: "#0EA5E9",
    secondary: "#0369A1",
    highlight: "#7DD3FC",
    shadow: "#0EA5E9",
  },
  roles: {
    primary: "#14B8A6",
    secondary: "#0F766E",
    highlight: "#5EEAD4",
    shadow: "#14B8A6",
  },
};

export function ActionIcon3D({
  type,
  icon: Icon,
  size = 50,
}: {
  type: ActionIcon3DType;
  icon: LucideIcon;
  size?: number;
}) {
  const theme = actionThemes[type] || actionThemes.create;
  const iconSize = Math.round(size * 0.48);

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          shadowColor: theme.shadow,
        },
      ]}
    >
      <Svg width={size} height={size} viewBox="0 0 50 50">
        <Defs>
          {/* Main 3D Spherical/Cube gradient */}
          <LinearGradient id={`grad_${type}`} x1="0.1" y1="0.1" x2="0.9" y2="0.9">
            <Stop offset="0%" stopColor={theme.highlight} stopOpacity="1" />
            <Stop offset="35%" stopColor={theme.primary} stopOpacity="1" />
            <Stop offset="100%" stopColor={theme.secondary} stopOpacity="1" />
          </LinearGradient>
          {/* Top glossy specular reflection */}
          <LinearGradient id={`gloss_${type}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.65" />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.05" />
          </LinearGradient>
          {/* Bottom bevel shadow */}
          <LinearGradient id={`shadow_${type}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#000000" stopOpacity="0" />
            <Stop offset="100%" stopColor="#000000" stopOpacity="0.3" />
          </LinearGradient>
        </Defs>

        {/* 3D Base squircle */}
        <Rect
          x="1"
          y="1"
          width="48"
          height="48"
          rx="15"
          ry="15"
          fill={`url(#grad_${type})`}
        />

        {/* Bottom 3D bevel shadow */}
        <Path
          d="M 5 36 Q 25 49 45 36 A 15 15 0 0 1 35 49 L 15 49 A 15 15 0 0 1 5 36 Z"
          fill={`url(#shadow_${type})`}
        />

        {/* Glossy top curvature bubble reflection */}
        <Path
          d="M 6 15 C 6 6 15 3 25 3 C 35 3 44 6 44 15 C 44 17 38 11 25 11 C 12 11 6 17 6 15 Z"
          fill={`url(#gloss_${type})`}
        />

        {/* 3D corner shine bead */}
        <Circle cx="12" cy="11" r="2.5" fill="#FFFFFF" fillOpacity="0.55" />
      </Svg>

      {/* Floating crisp foreground Icon */}
      <View style={styles.iconOverlay}>
        <Icon color="#FFFFFF" size={iconSize} strokeWidth={2.4} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 7,
    elevation: 4,
  },
  iconOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
});
