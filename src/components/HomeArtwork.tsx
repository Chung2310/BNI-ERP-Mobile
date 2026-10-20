import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from "react-native-svg";

export function MeetingMicGradient() {
  return (
    <Svg pointerEvents="none" width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
      <Defs>
        <LinearGradient id="meetingMicBlue" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#5AD8F8" />
          <Stop offset="0.45" stopColor="#1ABAFB" />
          <Stop offset="1" stopColor="#0786F8" />
        </LinearGradient>
      </Defs>
      <Rect width="100" height="100" fill="url(#meetingMicBlue)" />
    </Svg>
  );
}

export function GreetingWaves() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 400 180" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id="waveA" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#E9F8FF" />
          <Stop offset="1" stopColor="#A6E4FF" />
        </LinearGradient>
        <LinearGradient id="waveB" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#D4F3FF" />
          <Stop offset="1" stopColor="#42BEFA" />
        </LinearGradient>
        <LinearGradient id="waveC" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#A5E9FF" />
          <Stop offset="1" stopColor="#16A8F5" />
        </LinearGradient>
      </Defs>
      <Path d="M120 180 C195 112 250 150 316 84 C345 56 374 52 400 45 L400 180Z" fill="url(#waveA)" />
      <Path d="M155 180 C225 140 255 150 318 110 C352 88 376 88 400 82 L400 180Z" fill="url(#waveB)" opacity="0.76" />
      <Path d="M205 180 C260 154 304 155 350 129 C374 116 391 113 400 111 L400 180Z" fill="url(#waveC)" opacity="0.82" />
      <Path d="M260 180 C306 138 342 104 400 88" fill="none" stroke="#FFFFFF" strokeWidth="1.2" opacity="0.65" />
    </Svg>
  );
}

export function MeetingArtwork() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 230 230">
      <Defs>
        <LinearGradient id="halo" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.65" />
          <Stop offset="1" stopColor="#56B8FF" stopOpacity="0.3" />
        </LinearGradient>
        <LinearGradient id="page" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="1" stopColor="#D8E9FF" />
        </LinearGradient>
        <LinearGradient id="binding" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#5EBBFF" />
          <Stop offset="0.52" stopColor="#147DFA" />
          <Stop offset="1" stopColor="#0758D4" />
        </LinearGradient>
        <LinearGradient id="microphone" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#82C8FF" />
          <Stop offset="1" stopColor="#0E71F2" />
        </LinearGradient>
      </Defs>
      <Circle cx="116" cy="116" r="106" fill="url(#halo)" opacity="0.52" />
      <Circle cx="116" cy="116" r="88" fill="none" stroke="#F4FBFF" strokeWidth="10" opacity="0.5" />
      <Circle cx="26" cy="64" r="5" fill="#77C9FF" />
      <Circle cx="15" cy="91" r="3" fill="#71C3FF" />
      <Circle cx="212" cy="187" r="4" fill="#A1DAFF" />
      <Ellipse cx="134" cy="204" rx="74" ry="13" fill="#57A8EE" opacity="0.2" />
      <Path d="M76 54 L186 65 Q201 67 197 84 L181 178 Q177 194 162 190 L56 180 Q44 178 47 164 L61 70 Q64 52 76 54Z" fill="#4A9BF0" opacity="0.45" />
      <Path d="M72 46 L183 57 Q198 59 195 76 L179 173 Q177 186 163 184 L53 172 Q40 171 43 157 L58 62 Q60 44 72 46Z" fill="url(#page)" stroke="#FFFFFF" strokeWidth="2" />
      <Path d="M72 46 L183 57 Q198 59 195 76 L192 91 L55 77 L58 62 Q60 44 72 46Z" fill="url(#binding)" />
      <Path d="M85 54 C85 21 107 21 107 56 M143 60 C143 27 165 29 165 63" fill="none" stroke="#166CEB" strokeWidth="8" strokeLinecap="round" />
      <Path d="M88 53 C88 30 104 29 104 55 M146 59 C146 36 162 37 162 62" fill="none" stroke="#80CBFF" strokeWidth="3" strokeLinecap="round" />
      <G transform="rotate(8 118 135)">
        <Rect x="105" y="102" width="26" height="43" rx="13" fill="url(#microphone)" />
        <Path d="M95 128 C95 145 104 155 118 155 C132 155 141 145 141 128" fill="none" stroke="#3189F7" strokeWidth="6" strokeLinecap="round" />
        <Path d="M118 155 V169 M103 169 H133" fill="none" stroke="#247CEF" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M110 110 C111 107 114 106 117 106" fill="none" stroke="#C9ECFF" strokeWidth="3" strokeLinecap="round" opacity="0.75" />
      </G>
    </Svg>
  );
}
