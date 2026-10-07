import { useLocalSearchParams } from "expo-router";
import { RefreshCw } from "lucide-react-native";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { BackHeader } from "@/components/BackHeader";
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, LoadingState, Screen } from "@/components/ui";
import { useAsyncData } from "@/hooks/useAsyncData";
import { meetingService, type ProfileSlide } from "@/services/meeting";
import { colors, radius, spacing } from "@/theme/tokens";

const initials = (name: string) => name.split(" ").filter(Boolean).map((part) => part[0]).slice(-2).join("").toUpperCase();

export default function MeetingSlidesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: deck, error, isLoading, reload } = useAsyncData(() => meetingService.slides(id), id);

  return <Screen>
    <BackHeader title="Slide thuyết trình" subtitle={deck ? `${deck.slides.length} người trình bày` : undefined} />
    {isLoading && !deck ? <LoadingState /> : error && !deck ? <ErrorState message={error} onRetry={reload} /> : !deck ? null : !deck.slides.length ? (
      <EmptyState title="Chưa có slide" message="Slide sẽ xuất hiện khi có người tham gia check-in." />
    ) : deck.slides.map((slide, index) => <SlideCard key={slide.id} slide={slide} number={index + 1} />)}
    {deck ? <Button tone="secondary" icon={RefreshCw} onPress={reload}>Làm mới slide</Button> : null}
  </Screen>;
}

function SlideCard({ slide, number }: { slide: ProfileSlide; number: number }) {
  return <Card style={styles.card}>
    <View style={styles.heading}>
      <Badge tone="primary">SLIDE {number}</Badge>
      <Text style={styles.kind}>{slide.kind === "member" ? "Thành viên" : "Khách mời"}</Text>
    </View>
    {slide.coverImage ? <Image source={{ uri: slide.coverImage }} style={styles.cover} resizeMode="cover" /> : null}
    <View style={styles.person}>
      <Avatar initials={initials(slide.name)} url={slide.photoURL} size={52} />
      <View style={styles.grow}>
        <Text style={styles.name}>{slide.name}</Text>
        {slide.company ? <Text style={styles.meta}>{slide.company}</Text> : null}
        {slide.industry ? <Text style={styles.meta}>{slide.industry}</Text> : null}
      </View>
    </View>
    {slide.bio ? <Text style={styles.body}>{slide.bio}</Text> : null}
    {slide.targetMarket ? <Text style={styles.meta}>Khách hàng mục tiêu: {slide.targetMarket}</Text> : null}
    {slide.galleryImages?.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gallery}>
      {slide.galleryImages.map((url, index) => <Image key={`${url}-${index}`} source={{ uri: url }} style={styles.galleryImage} resizeMode="cover" />)}
    </ScrollView> : null}
  </Card>;
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  kind: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  cover: { width: "100%", height: 138, borderRadius: radius.md, backgroundColor: colors.background },
  person: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  grow: { flex: 1 },
  name: { color: colors.text, fontSize: 16, fontWeight: "900" },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  body: { color: colors.text, fontSize: 12, lineHeight: 18 },
  gallery: { gap: spacing.sm },
  galleryImage: { width: 116, height: 78, borderRadius: radius.sm, backgroundColor: colors.background },
});
