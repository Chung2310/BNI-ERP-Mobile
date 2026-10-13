import Svg, { Circle, Path, Rect } from "react-native-svg";

export type UtilityIconName =
  | "schedule"
  | "statistics"
  | "chapter"
  | "members"
  | "createMeeting"
  | "chat"
  | "ranking"
  | "settings";

type Props = { name: UtilityIconName; color: string; accent: string };

// Original pictograms for iGen Connect. Each icon repeats a small connected node.
export function UtilityIcon({ name, color, accent }: Props) {
  const common = { width: 32, height: 32, viewBox: "0 0 48 48" } as const;

  switch (name) {
    case "schedule":
      return <Svg {...common}>
        <Rect x="6" y="9" width="36" height="34" rx="9" fill={color} />
        <Path d="M6 20h36" stroke="#FFFFFF" strokeWidth="3" opacity="0.75" />
        <Rect x="13" y="5" width="5" height="11" rx="2.5" fill={accent} />
        <Rect x="30" y="5" width="5" height="11" rx="2.5" fill={accent} />
        <Path d="m16 31 5 5 11-12" fill="none" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx="37" cy="35" r="4" fill={accent} />
      </Svg>;
    case "statistics":
      return <Svg {...common}>
        <Rect x="7" y="28" width="8" height="13" rx="3" fill={color} opacity="0.6" />
        <Rect x="20" y="20" width="8" height="21" rx="3" fill={color} opacity="0.82" />
        <Rect x="33" y="10" width="8" height="31" rx="3" fill={color} />
        <Path d="m10 21 13-9 13 3" fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx="10" cy="21" r="3.5" fill={accent} />
        <Circle cx="23" cy="12" r="3.5" fill={accent} />
        <Circle cx="36" cy="15" r="3.5" fill={accent} />
      </Svg>;
    case "chapter":
      return <Svg {...common}>
        <Path d="M12 40V13a5 5 0 0 1 5-5h14a5 5 0 0 1 5 5v27H12Z" fill={color} />
        <Rect x="17" y="15" width="5" height="5" rx="1.5" fill="#FFFFFF" />
        <Rect x="26" y="15" width="5" height="5" rx="1.5" fill="#FFFFFF" />
        <Rect x="17" y="24" width="5" height="5" rx="1.5" fill="#FFFFFF" />
        <Rect x="26" y="24" width="5" height="5" rx="1.5" fill="#FFFFFF" />
        <Path d="M21 40v-7a3 3 0 0 1 6 0v7" fill={accent} />
        <Path d="M7 39h34" stroke={color} strokeWidth="3" strokeLinecap="round" />
        <Circle cx="39" cy="11" r="5" fill={accent} />
      </Svg>;
    case "members":
      return <Svg {...common}>
        <Circle cx="17" cy="17" r="7" fill={color} />
        <Circle cx="34" cy="19" r="5.5" fill={accent} />
        <Path d="M5 37c0-7 5.5-12 12-12s12 5 12 12v3H5v-3Z" fill={color} />
        <Path d="M29 29c6.8-2.5 14 2.3 14 9v2H32v-3c0-3-1-5.7-3-8Z" fill={accent} />
        <Circle cx="38" cy="8" r="3" fill={accent} />
      </Svg>;
    case "createMeeting":
      return <Svg {...common}>
        <Rect x="6" y="9" width="34" height="33" rx="8" fill={color} />
        <Path d="M6 20h34" stroke="#FFFFFF" strokeWidth="3" opacity="0.7" />
        <Rect x="13" y="5" width="5" height="11" rx="2.5" fill={accent} />
        <Rect x="29" y="5" width="5" height="11" rx="2.5" fill={accent} />
        <Circle cx="30" cy="32" r="11" fill={accent} stroke="#FFFFFF" strokeWidth="2" />
        <Path d="M30 26v12M24 32h12" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
      </Svg>;
    case "chat":
      return <Svg {...common}>
        <Path d="M5 13a8 8 0 0 1 8-8h18a8 8 0 0 1 8 8v15a8 8 0 0 1-8 8H18L8 43v-9a8 8 0 0 1-3-6V13Z" fill={color} />
        <Circle cx="15" cy="21" r="2.8" fill="#FFFFFF" />
        <Circle cx="24" cy="21" r="2.8" fill="#FFFFFF" />
        <Circle cx="33" cy="21" r="2.8" fill="#FFFFFF" />
        <Circle cx="38" cy="38" r="5" fill={accent} stroke="#FFFFFF" strokeWidth="2" />
      </Svg>;
    case "ranking":
      return <Svg {...common}>
        <Rect x="5" y="28" width="11" height="14" rx="3" fill={color} opacity="0.65" />
        <Rect x="18" y="18" width="12" height="24" rx="3" fill={color} />
        <Rect x="32" y="24" width="11" height="18" rx="3" fill={color} opacity="0.8" />
        <Path d="m24 5 2.3 4.8 5.3.8-3.8 3.7.9 5.2-4.7-2.5-4.7 2.5.9-5.2-3.8-3.7 5.3-.8L24 5Z" fill={accent} />
        <Circle cx="39" cy="13" r="3" fill={accent} />
      </Svg>;
    case "settings":
      return <Svg {...common}>
        <Path d="M20 5h8l1.5 5.3 4 1.7 4.8-2.7 5.5 5.6-2.7 4.8 1.7 4L48 25v8l-5.2 1.5-1.7 4 2.7 4.8-5.5 5.5-4.8-2.7-4 1.7L28 53h-8l-1.5-5.2-4-1.7-4.8 2.7-5.5-5.5 2.7-4.8-1.7-4L0 33v-8l5.2-1.5 1.7-4-2.7-4.8 5.5-5.6 4.8 2.7 4-1.7L20 5Z" fill={color} transform="translate(4 3) scale(.83)" />
        <Circle cx="24" cy="27" r="8" fill="#FFFFFF" />
        <Circle cx="24" cy="27" r="4" fill={accent} />
        <Circle cx="38" cy="11" r="4" fill={accent} />
      </Svg>;
  }
}

export function UtilityLockIcon() {
  return <Svg width={14} height={14} viewBox="0 0 16 16">
    <Path d="M4.5 7V5a3.5 3.5 0 0 1 7 0v2" fill="none" stroke="#00ADFC" strokeWidth="2" strokeLinecap="round" />
    <Rect x="2.5" y="7" width="11" height="8" rx="2.5" fill="#00ADFC" />
    <Circle cx="8" cy="11" r="1" fill="#FFFFFF" />
  </Svg>;
}
