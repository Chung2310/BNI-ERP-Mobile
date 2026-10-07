import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { AppHeader, EmptyState, ErrorState, LoadingState, Screen } from "@/components/ui";
import { MemberCard } from "@/components/MemberCard";
import { userService } from "@/services/users";
import { colors, radius, spacing, touchTarget } from "@/theme/tokens";
import type { MemberSummary, UserProfile } from "@/types";

const extractCompany = (u: any): string => {
  if (!u) return "";
  if (typeof u.company === "string" && u.company.trim()) return u.company.trim();
  if (typeof u.companyName === "string" && u.companyName.trim()) return u.companyName.trim();
  if (typeof u.company_name === "string" && u.company_name.trim()) return u.company_name.trim();
  if (typeof u.businessName === "string" && u.businessName.trim()) return u.businessName.trim();
  if (typeof u.enterpriseName === "string" && u.enterpriseName.trim()) return u.enterpriseName.trim();
  if (typeof u.tenDoanhNghiep === "string" && u.tenDoanhNghiep.trim()) return u.tenDoanhNghiep.trim();
  if (typeof u.tenCongTy === "string" && u.tenCongTy.trim()) return u.tenCongTy.trim();
  if (typeof u.business === "string" && u.business.trim()) return u.business.trim();
  if (typeof u.enterprise === "string" && u.enterprise.trim()) return u.enterprise.trim();
  if (u.company && typeof u.company === "object") {
    const name = u.company.name || u.company.companyName || u.company.title || u.company.businessName;
    if (typeof name === "string" && name.trim()) return name.trim();
  }
  if (u.business && typeof u.business === "object") {
    const name = u.business.name || u.business.title;
    if (typeof name === "string" && name.trim()) return name.trim();
  }
  if (typeof u.branchName === "string" && u.branchName.trim()) return u.branchName.trim();
  if (typeof u.companyCode === "string" && u.companyCode.trim()) return u.companyCode.trim();
  return "";
};

const extractPhone = (u: any): string => {
  if (!u) return "";
  const p =
    u.phone ??
    u.phoneNumber ??
    u.phone_number ??
    u.mobile ??
    u.telephone ??
    u.sdt ??
    u.soDienThoai ??
    u.contactPhone ??
    u.tel;
  return typeof p === "string" ? p.trim() : typeof p === "number" ? String(p) : "";
};

const extractEmail = (u: any): string => {
  if (!u) return "";
  const e = u.email ?? u.mail ?? u.emailAddress;
  return typeof e === "string" ? e.trim() : "";
};

const extractIndustry = (u: any): string => {
  if (!u) return "";
  const ind =
    u.industry ??
    u.field ??
    u.profession ??
    u.businessField ??
    u.linhVuc ??
    u.career;
  if (typeof ind === "string" && ind.trim()) return ind.trim();
  if (ind && typeof ind === "object" && typeof ind.name === "string") return ind.name.trim();
  return "";
};

const extractAvatar = (u: any): string => {
  if (!u) return "";
  const a =
    u.photoURL ??
    u.avatar ??
    u.avatarUrl ??
    u.avatar_url ??
    u.photoUrl ??
    u.image ??
    u.picture;
  return typeof a === "string" ? a.trim() : "";
};

const extractCover = (u: any): string => {
  if (!u) return "";
  const c =
    u.coverUrl ??
    u.coverImage ??
    u.coverPhoto ??
    u.cover ??
    u.cover_url ??
    u.backgroundUrl ??
    u.backgroundImage;
  return typeof c === "string" ? c.trim() : "";
};

export default function MembersScreen() {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<UserProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const loadingRef = useRef(false);

  const loadPage = useCallback(async (nextPage: number, reset = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (reset) setIsLoading(true);
    else setIsLoadingMore(true);
    setError("");
    try {
      const result = await userService.directoryPage(nextPage, 20);
      setData((current) => {
        const combined = reset ? result.items : [...current, ...result.items];
        return Array.from(new Map(combined.map((user) => [user.uid, user])).values());
      });
      setTotal(result.total);
      setPage(result.page);
      setHasMore(result.hasMore);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tải danh sách thành viên.");
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void loadPage(1, true), 0);
    return () => clearTimeout(timer);
  }, [loadPage]);

  const reload = useCallback(() => loadPage(1, true), [loadPage]);
  const loadMore = useCallback(() => {
    if (hasMore && !loadingRef.current) void loadPage(page + 1);
  }, [hasMore, loadPage, page]);
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 280) loadMore();
  }, [loadMore]);

  const members = useMemo(
    () =>
      data
        .filter((user: UserProfile) => {
          const raw = user as Record<string, unknown>;
          const name = user.displayName || "";
          const company = extractCompany(raw);
          const phone = extractPhone(raw);
          const email = extractEmail(raw);
          const industry = extractIndustry(raw);
          const searchTarget = `${name} ${industry} ${company} ${email} ${phone}`.toLowerCase();
          return searchTarget.includes(query.trim().toLowerCase());
        })
        .map((user: UserProfile) => {
          const raw = user as Record<string, unknown>;
          const company = extractCompany(raw);
          const phone = extractPhone(raw);
          const email = extractEmail(raw);
          const industry = extractIndustry(raw);
          const avatarUrl = extractAvatar(raw);
          const coverUrl = extractCover(raw);

          return {
            id: user.uid,
            initials: (user.displayName || "TV")
              .split(" ")
              .filter(Boolean)
              .map((part: string) => part[0])
              .slice(-2)
              .join("")
              .toUpperCase(),
            name: user.displayName || "Thành viên",
            industry: industry || "Chưa cập nhật",
            company: company || "Chưa cập nhật",
            email: email || undefined,
            phone: phone || undefined,
            avatarUrl: avatarUrl || undefined,
            coverUrl: coverUrl || undefined,
          };
        }),
    [data, query]
  );

  return (
    <Screen scrollViewProps={{ onScroll, scrollEventThrottle: 16 }}>
      <AppHeader title="Thành viên" subtitle={total ? "Đã tải " + data.length + "/" + total + " thành viên" : "Danh sách thành viên"} />
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Tìm tên, lĩnh vực, công ty, email, SĐT..."
        placeholderTextColor={colors.muted}
        style={styles.search}
      />
      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : members.length === 0 ? (
        <EmptyState
          title="Không tìm thấy"
          message={hasMore ? "Không có kết quả trong các thành viên đã tải. Cuộn xuống để tải thêm." : "Thử tìm bằng tên, lĩnh vực, công ty hoặc thông tin liên hệ khác."}
        />
      ) : (
        <View style={styles.list}>
          {members.map((member: MemberSummary) => (
            <MemberCard key={member.id} member={member} />
          ))}
        </View>
      )}
      {isLoadingMore ? <View style={styles.loadingMore}><ActivityIndicator color={colors.primary} /><Text style={styles.loadingText}>Đang tải thêm 20 thành viên...</Text></View> : null}
      {!isLoading && !hasMore && data.length > 0 ? <Text style={styles.endText}>Đã hiển thị toàn bộ {total} thành viên</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: {
    minHeight: touchTarget,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    color: colors.text,
  },
  list: {
    gap: spacing.md,
  },
  loadingMore: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 12,
  },
  endText: {
    color: colors.muted,
    fontSize: 12,
    textAlign: "center",
    paddingVertical: spacing.sm,
  },
});
