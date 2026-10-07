import { useState } from "react";
import { ChevronLeft, ChevronRight, File, FileText, Folder } from "lucide-react-native";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { BackHeader } from "@/components/BackHeader";
import { Card, EmptyState, ErrorState, LoadingState, Screen } from "@/components/ui";
import { useAsyncData } from "@/hooks/useAsyncData";
import { resourceService, type ResourceItem } from "@/services/resources";
import { colors, spacing } from "@/theme/tokens";

export default function ResourcesScreen() {
  const [folder, setFolder] = useState<ResourceItem | null>(null);
  const { data, error, isLoading, reload } = useAsyncData(() => resourceService.list(folder?._id || null), folder?._id || "root");
  const open = async (item: ResourceItem) => { if (item.type === "folder") setFolder(item); else if (item.fileUrl) await Linking.openURL(item.fileUrl); };
  return (
    <Screen>
      <BackHeader title={folder?.name || "Tài nguyên"} subtitle={folder ? "Thư mục tài nguyên" : "Không gian làm việc"} compact />
      {folder ? <Pressable onPress={() => setFolder(null)} style={styles.back}><ChevronLeft color={colors.primaryDark} size={18} /><Text style={styles.backText}>Về thư mục gốc</Text></Pressable> : null}
      {isLoading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={reload} /> : !data?.length ? <EmptyState title="Thư mục trống" message="Chưa có tài nguyên trong thư mục này." /> : <Card style={styles.list}>{data.map((item) => { const ItemIcon = item.type === "folder" ? Folder : item.mimeType?.includes("pdf") ? FileText : File; return <Pressable key={item._id} onPress={() => open(item)} style={styles.row}><View style={styles.icon}><ItemIcon color={colors.primaryDark} size={22} strokeWidth={1.9} /></View><View style={styles.grow}><Text style={styles.name}>{item.name}</Text><Text style={styles.meta}>{item.type === "folder" ? "Thư mục" : formatSize(item.size)} · {new Date(item.createdAt).toLocaleDateString("vi-VN")}</Text></View><ChevronRight color={colors.muted} size={20} /></Pressable>; })}</Card>}
    </Screen>
  );
}

function formatSize(size?: number) { if (!size) return "Không rõ dung lượng"; if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`; return `${(size / 1024 / 1024).toFixed(1)} MB`; }
const styles = StyleSheet.create({ back: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.xs }, backText: { color: colors.primaryDark, fontSize: 12, fontWeight: "800" }, list: { paddingVertical: 0 }, row: { minHeight: 70, flexDirection: "row", alignItems: "center", gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, icon: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: colors.primarySoft }, grow: { flex: 1 }, name: { color: colors.text, fontSize: 14, fontWeight: "800" }, meta: { marginTop: 3, color: colors.muted, fontSize: 11 } });
