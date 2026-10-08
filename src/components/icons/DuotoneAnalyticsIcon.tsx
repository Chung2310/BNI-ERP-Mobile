import React from "react";
import Svg, { Circle, Path, Rect } from "react-native-svg";

export function DuotoneAnalyticsIcon({
  color = "#00AECA",
  size = 25,
  strokeWidth = 1.8,
}: {
  color?: string;
  size?: number;
  strokeWidth?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Cột 1: Cột khởi đầu (màu nhẹ nhàng) */}
      <Rect
        x="2.5"
        y="12"
        width="4.5"
        height="9"
        rx="2.25"
        fill={color}
        fillOpacity={0.25}
      />

      {/* Cột 2: Cột phát triển (màu vừa) */}
      <Rect
        x="9.75"
        y="7"
        width="4.5"
        height="14"
        rx="2.25"
        fill={color}
        fillOpacity={0.5}
      />

      {/* Cột 3: Cột bứt phá (màu đậm, cao nhất) */}
      <Rect
        x="17"
        y="3"
        width="4.5"
        height="18"
        rx="2.25"
        fill={color}
      />

      {/* Đường xu hướng tăng trưởng (Growth trendline) */}
      <Path
        d="M2.5 10 C 6 8.5, 11 4.5, 17 2"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />

      {/* Điểm nhấn thành tích ở đỉnh cột */}
      <Circle
        cx="17"
        cy="2"
        r="1.8"
        fill="#FFFFFF"
        stroke={color}
        strokeWidth="1.6"
      />
    </Svg>
  );
}
