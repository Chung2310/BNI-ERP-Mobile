import React from "react";
import Svg, { Circle, Path, Rect } from "react-native-svg";

export { DuotoneAnalyticsIcon } from "./DuotoneAnalyticsIcon";

export function DuotoneCalendarIcon({
  color = "#00AECA",
  size = 25,
}: {
  color?: string;
  size?: number;
  strokeWidth?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Khung thân lịch (màu nhạt làm nền) */}
      <Rect
        x="3"
        y="5"
        width="18"
        height="16"
        rx="3.5"
        fill={color}
        fillOpacity={0.25}
      />
      {/* Nắp header lịch (màu đậm tạo điểm nhấn) */}
      <Path
        d="M3 8.5C3 6.567 4.567 5 6.5 5H17.5C19.433 5 21 6.567 21 8.5V9.5H3V8.5Z"
        fill={color}
      />
      {/* 2 móc treo lịch */}
      <Rect x="7" y="2.5" width="2" height="4.5" rx="1" fill={color} />
      <Rect x="15" y="2.5" width="2" height="4.5" rx="1" fill={color} />
      {/* Các chấm ngày bên trong */}
      <Circle cx="7.5" cy="13.2" r="1.3" fill={color} />
      <Circle cx="12" cy="13.2" r="1.3" fill={color} />
      <Circle cx="16.5" cy="13.2" r="1.3" fill={color} />
      <Circle cx="7.5" cy="17" r="1.3" fill={color} />
      <Rect x="10.75" y="15.8" width="5.75" height="2.4" rx="1.2" fill={color} />
    </Svg>
  );
}

export function DuotoneCreateMeetingIcon({
  color = "#00AECA",
  size = 25,
}: {
  color?: string;
  size?: number;
  strokeWidth?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Khung thân lịch */}
      <Rect
        x="3"
        y="5"
        width="18"
        height="16"
        rx="3.5"
        fill={color}
        fillOpacity={0.25}
      />
      {/* Nắp header lịch */}
      <Path
        d="M3 8.5C3 6.567 4.567 5 6.5 5H17.5C19.433 5 21 6.567 21 8.5V9.5H3V8.5Z"
        fill={color}
      />
      {/* 2 móc treo */}
      <Rect x="7" y="2.5" width="2" height="4.5" rx="1" fill={color} />
      <Rect x="15" y="2.5" width="2" height="4.5" rx="1" fill={color} />
      {/* Huy hiệu tròn có dấu cộng tạo cuộc họp */}
      <Circle cx="15.5" cy="15.5" r="4.8" fill={color} />
      <Path
        d="M15.5 13.3V17.7M13.3 15.5H17.7"
        stroke="#FFFFFF"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function DuotoneChatIcon({
  color = "#00AECA",
  size = 25,
}: {
  color?: string;
  size?: number;
  strokeWidth?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Bong bóng trò chuyện nền nhạt */}
      <Path
        d="M4 4.5C4 3.12 5.12 2 6.5 2H17.5C18.88 2 20 3.12 20 4.5V15.5C20 16.88 18.88 18 17.5 18H10L5 22V18.5C4.42 18.04 4 17.3 4 16.5V4.5Z"
        fill={color}
        fillOpacity={0.25}
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <Circle cx="8" cy="10" r="1.2" fill={color} />
      <Circle cx="12" cy="10" r="1.2" fill={color} />
      <Circle cx="16" cy="10" r="1.2" fill={color} />
    </Svg>
  );
}

export function DuotoneTrophyIcon({
  color = "#00AECA",
  size = 25,
}: {
  color?: string;
  size?: number;
  strokeWidth?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Bầu cúp nền nhạt */}
      <Path
        d="M6 3H18V9C18 12.314 15.314 15 12 15C8.686 15 6 12.314 6 9V3Z"
        fill={color}
        fillOpacity={0.25}
        stroke={color}
        strokeWidth="1.6"
      />
      {/* 2 quai cúp */}
      <Path
        d="M6 5H4C2.895 5 2 5.895 2 7C2 9.209 3.791 11 6 11"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <Path
        d="M18 5H20C21.105 5 22 5.895 22 7C22 9.209 20.209 11 18 11"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {/* Chân đế cúp */}
      <Path d="M12 15V18.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Rect x="7" y="18.5" width="10" height="3" rx="1.5" fill={color} />
      {/* Ngôi sao chiến thắng ở giữa cúp */}
      <Path
        d="M12 6.5L12.8 8.1L14.6 8.4L13.3 9.7L13.6 11.5L12 10.6L10.4 11.5L10.7 9.7L9.4 8.4L11.2 8.1L12 6.5Z"
        fill={color}
      />
    </Svg>
  );
}

export function DuotoneFolderIcon({
  color = "#00AECA",
  size = 25,
}: {
  color?: string;
  size?: number;
  strokeWidth?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Nắp sau folder */}
      <Path
        d="M3 6.5C3 5.12 4.12 4 5.5 4H9.2C10 4 10.7 4.4 11.1 5L12.4 6.8C12.8 7.4 13.5 7.8 14.3 7.8H18.5C19.88 7.8 21 8.92 21 10.3V18C21 19.38 19.88 20.5 18.5 20.5H5.5C4.12 20.5 3 19.38 3 18V6.5Z"
        fill={color}
        fillOpacity={0.25}
      />
      {/* Nắp trước mở nhẹ (front flap) tạo chiều sâu 3D */}
      <Path
        d="M2.5 10C2.5 8.9 3.4 8 4.5 8H19.5C20.6 8 21.5 8.9 21.5 10V18C21.5 19.38 20.38 20.5 19 20.5H5C3.62 20.5 2.5 19.38 2.5 18V10Z"
        fill={color}
        fillOpacity={0.4}
        stroke={color}
        strokeWidth="1.5"
      />
      {/* Vạch tài liệu bên trong */}
      <Rect x="6.5" y="13.2" width="7" height="1.8" rx="0.9" fill={color} />
      <Circle cx="16.5" cy="14.1" r="1.2" fill={color} />
    </Svg>
  );
}

export function DuotoneSettingsIcon({
  color = "#00AECA",
  size = 25,
}: {
  color?: string;
  size?: number;
  strokeWidth?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Vòng ngoài bánh răng mảng nhạt */}
      <Circle cx="12" cy="12" r="8" fill={color} fillOpacity={0.25} />
      {/* Các mấu răng cưa */}
      <Path
        d="M12 2.5V4.5M12 19.5V21.5M2.5 12H4.5M19.5 12H21.5M5.28 5.28L6.7 6.7M17.3 17.3L18.72 18.72M5.28 18.72L6.7 17.3M17.3 6.7L18.72 5.28"
        stroke={color}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      {/* Vành đĩa bánh răng */}
      <Circle cx="12" cy="12" r="5" stroke={color} strokeWidth="1.6" />
      {/* Trục tâm đậm */}
      <Circle cx="12" cy="12" r="2.2" fill={color} />
    </Svg>
  );
}

export function DuotoneShieldIcon({
  color = "#00AECA",
  size = 25,
}: {
  color?: string;
  size?: number;
  strokeWidth?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Thân khiên nền nhạt */}
      <Path
        d="M12 2.5L19.5 5.8V11.5C19.5 16.5 16.3 20.8 12 22C7.7 20.8 4.5 16.5 4.5 11.5V5.8L12 2.5Z"
        fill={color}
        fillOpacity={0.25}
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* Dấu tích bảo vệ / quyền hạn */}
      <Path
        d="M9 11.8L11.2 14L15.5 9.5"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
