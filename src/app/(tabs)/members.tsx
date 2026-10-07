import { useMemo, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { AppHeader, EmptyState, ErrorState, LoadingState, Screen } from "@/components/ui";
import { MemberCard } from "@/components/MemberCard";
import { useAsyncData } from "@/hooks/useAsyncData";
import { userService } from "@/services/users";
import { colors, radius, spacing, touchTarget } from "@/theme/tokens";

export default function MembersScreen() {
  const [query, setQuery] = useState("");
  const { data, error, isLoading, reload } = useAsyncData(userService.colleagues);
  const members = useMemo(() => (data || []).filter((user) => `${user.displayName} ${user.industry || ""} ${user.companyName || ""}`.toLowerCase().includes(query.trim().toLowerCase())).map((user) => ({ id: user.uid, initials: user.displayName.split(" ").map((part) => part[0]).slice(-2).join("").toUpperCase(), name: user.displayName, role: user.role, industry: user.industry || "Chưa cập nhật", company: user.companyName || user.companyCode || "iGen Connect" })), [data, query]);
  return (
    <Screen>
      <AppHeader title="Thành viên" subtitle={`${data?.length || 0} thành viên`} />
      <TextInput value={query} onChangeText={setQuery} placeholder="Tìm tên, lĩnh vực, công ty..." placeholderTextColor={colors.muted} style={styles.search} />
      {isLoading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={reload} /> : members.length === 0 ? <EmptyState title="Không tìm thấy" message="Thử tìm bằng tên, lĩnh vực hoặc công ty khác." /> : <View style={styles.grid}>{members.map((member) => <MemberCard key={member.id} member={member} />)}</View>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: { minHeight: touchTarget, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: spacing.md, color: colors.text },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
});
