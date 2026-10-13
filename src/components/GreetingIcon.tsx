import Svg, { Circle, Path } from "react-native-svg";

type GreetingIconName = "sun" | "cloud" | "moon";

export function GreetingIcon({ name }: { name: GreetingIconName }) {
  if (name === "sun") {
    return (
      <Svg width={20} height={20} viewBox="0 0 32 32">
        <Path
          d="M16 2v4M16 26v4M2 16h4M26 16h4M6.1 6.1l2.9 2.9M23 23l2.9 2.9M25.9 6.1 23 9M9 23l-2.9 2.9"
          stroke="#E79A16"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <Circle cx="16" cy="16" r="7" fill="#FFC857" />
        <Circle cx="13.5" cy="13.5" r="2" fill="#FFE49A" />
      </Svg>
    );
  }

  if (name === "cloud") {
    return (
      <Svg width={20} height={20} viewBox="0 0 32 32">
        <Circle cx="10" cy="11" r="3" fill="#FFD166" />
        <Path
          d="M8 25h16a5 5 0 0 0 .3-10 8 8 0 0 0-15.5-1.4A5.8 5.8 0 0 0 8 25Z"
          fill="#FFFFFF"
          stroke="#6FA9C4"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <Path d="M10 21h12" stroke="#C7E8F2" strokeWidth="1.5" strokeLinecap="round" />
      </Svg>
    );
  }

  return (
    <Svg width={20} height={20} viewBox="0 0 32 32">
      <Path
        d="M16 3A13 13 0 1 0 29 16 10 10 0 0 1 16 3Z"
        fill="#F8CA68"
        stroke="#D59B38"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <Circle cx="25" cy="6" r="1.5" fill="#F8CA68" />
    </Svg>
  );
}
