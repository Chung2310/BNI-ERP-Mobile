import { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { galleryImagesFrom, mediaUrl } from "@/utils/media";
import type { ProfileSlide } from "@/services/meeting";

const WIDTH = 1920;
const HEIGHT = 1080;
const RED = "#d70b2d";

export function ProfileSlideCanvas({ slide, width }: { slide: ProfileSlide; width: number }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const scale = width / WIDTH;
  const px = (value: number) => value * scale;
  const box = (x: number, y: number, w: number, h: number) => ({ position: "absolute" as const, left: px(x), top: px(y), width: px(w), height: px(h) });
  const label = (size: number, color = "#FFFFFF") => ({ fontSize: px(size), lineHeight: px(size * 1.28), fontWeight: "800" as const, color, textAlign: "center" as const, includeFontPadding: false });
  const photo = slide.photoURL && !photoFailed ? { uri: mediaUrl(slide.photoURL) } : require("../../../assets/meeting-slide/default-pfp.jpg");
  const gallery = galleryImagesFrom(slide).slice(0, 5);

  return <View style={[styles.canvas, { width, height: width * HEIGHT / WIDTH }]}>
    <Image source={require("../../../assets/meeting-slide/background.jpeg")} style={[box(0, 0, WIDTH, HEIGHT), styles.background]} resizeMode="stretch" />
    <View style={[box(0, 0, WIDTH, HEIGHT), styles.wash]} />
    <View style={[box(55, 28, 288, 191), styles.logoPanel]} />
    <Image source={require("../../../assets/meeting-slide/bni.png")} style={box(92, 36, 215, 105)} resizeMode="contain" />
    <Text style={[box(66, 145, 266, 42), label(37, "#626262")]}>KINH BAC</Text>
    <Text style={[box(66, 187, 266, 28), label(21, "#626262")]}>TITANIUMCHAPTER</Text>
    <View style={[box(373, 28, 1500, 112), styles.ribbon]}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={label(44)}>{slide.kind === "member" ? "THÔNG TIN THÀNH VIÊN / MEMBER PROFILE" : "THÔNG TIN KHÁCH MỜI / GUEST PROFILE"}</Text>
    </View>

    <Image source={photo} onError={() => setPhotoFailed(true)} style={[box(158, 288, 360, 360), { borderRadius: px(180) }]} resizeMode="cover" />
    <Image source={require("../../../assets/meeting-slide/portrait-frame.png")} style={box(100, 247, 480, 456)} resizeMode="stretch" />
    <View style={[box(60, 710, 575, 62), styles.namePill]}><Text numberOfLines={1} adjustsFontSizeToFit style={label(28)}>{slide.name?.toLocaleUpperCase("vi-VN")}</Text></View>
    {slide.company ? <Text numberOfLines={2} style={[box(48, 790, 600, 82), label(30, RED)]}>{slide.company.toLocaleUpperCase("vi-VN")}</Text> : null}
    {slide.phone ? <Text numberOfLines={1} style={[box(48, 882, 600, 42), label(27, "#00ADFC")]}>HOTLINE: {slide.phone}</Text> : null}
    {slide.address ? <Text numberOfLines={3} style={[box(48, 933, 600, 110), { ...label(27, "#00ADFC"), textAlign: "left" }]}>{slide.address}</Text> : null}

    {slide.industry ? <>
      <View style={[box(710, 252, 1100, 148), styles.industry]}><Text numberOfLines={3} adjustsFontSizeToFit style={label(45)}>{slide.industry.toLocaleUpperCase("vi-VN")}</Text></View>
      <View style={[box(765, 212, 465, 54), styles.namePill]}><Text style={label(26)}>LĨNH VỰC HOẠT ĐỘNG</Text></View>
    </> : null}

    {gallery.length ? <>
      <View style={[box(710, 432, 485, 54), styles.namePill]}><Text style={label(26)}>SẢN PHẨM TIÊU BIỂU</Text></View>
      {gallery.map((url, index) => {
        const gap = 18;
        const cellWidth = (1120 - gap * (gallery.length - 1)) / gallery.length;
        return <Image key={`${url}-${index}`} source={{ uri: mediaUrl(url) }} style={[box(710 + index * (cellWidth + gap), 504, cellWidth, 235), styles.galleryImage]} resizeMode="contain" />;
      })}
    </> : null}

    {slide.targetMarket ? <>
      <View style={[box(710, 777, 470, 54), styles.namePill]}><Text style={label(26)}>THỊ TRƯỜNG MỤC TIÊU</Text></View>
      <Text numberOfLines={5} style={[box(735, 850, 1020, 176), { fontSize: px(39), lineHeight: px(47), fontWeight: "700", color: "#00ADFC", includeFontPadding: false }]}>{slide.targetMarket}</Text>
    </> : null}
    <View style={[box(1690, 990, 230, 90), styles.footerRed]} />
  </View>;
}

const styles = StyleSheet.create({
  canvas: { backgroundColor: "#FFFFFF", overflow: "hidden" },
  background: { opacity: 0.53 },
  wash: { backgroundColor: "rgba(255,255,255,0.1)" },
  logoPanel: { backgroundColor: "#FFFFFF", elevation: 2 },
  ribbon: { backgroundColor: RED, alignItems: "center", justifyContent: "center" },
  namePill: { backgroundColor: "#d70b2d", borderRadius: 8, alignItems: "center", justifyContent: "center" },
  industry: { backgroundColor: "#cc4300", borderWidth: 3, borderColor: "#f3ce60", alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  galleryImage: { backgroundColor: "rgba(255,255,255,0.45)" },
  footerRed: { backgroundColor: "#e61839", transform: [{ skewX: "-35deg" }] },
});
