import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Search, X } from "lucide-react-native";
import { EmptyState, ErrorState, LoadingState, Screen } from "@/components/ui";
import { BackHeader } from "@/components/BackHeader";
import { HeaderAddButton } from "@/components/HeaderAddButton";
import { MemberCard } from "@/components/MemberCard";
import { AddMemberModal } from "@/components/AddMemberModal";
import { userService } from "@/services/users";
import { colors, radius, spacing } from "@/theme/tokens";
import type { MemberSummary, UserProfile } from "@/types";

const PAGE_SIZE = 15;

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
  const [showAddModal, setShowAddModal] = useState(false);
  const loadingRef = useRef(false);

  const loadPage = useCallback(async (nextPage: number, reset = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (reset) setIsLoading(true);
    else setIsLoadingMore(true);
    setError("");
    try {
      const result = await userService.directoryPage(nextPage, PAGE_SIZE);
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

  const isSearching = Boolean(query.trim());

  return (
    <Screen style={styles.screen}>
      <View style={styles.headerContainer}>
        <BackHeader
          title="Thành viên"
          compact
          subtitle={
            isLoading || error
              ? undefined
              : isSearching
              ? `Tìm thấy ${members.length} thành viên`
              : `${total} thành viên`
          }
          action={
            <HeaderAddButton
              accessibilityLabel="Thêm thành viên"
              onPress={() => setShowAddModal(true)}
            />
          }
        />
      </View>

      {/* Nút tìm kiếm thành viên bo tròn hoàn toàn (pill), có icon kính lúp */}
      <View style={styles.searchWrapper}>
        <View style={styles.searchContainer}>
          <Search size={18} color={colors.muted} strokeWidth={2.2} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Tìm kiếm thành viên..."
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            returnKeyType="search"
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery("")} hitSlop={8} style={styles.clearBtn}>
              <X size={16} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.stateContainer}>
          <LoadingState />
        </View>
      ) : error ? (
        <View style={[styles.stateContainer, styles.errorContainer]}>
          <ErrorState message={error} onRetry={reload} />
        </View>
      ) : members.length === 0 ? (
        <View style={styles.stateContainer}>
          <EmptyState
            title="Không tìm thấy"
            message={
              isSearching
                ? "Không tìm thấy thành viên phù hợp với từ khóa."
                : "Danh sách thành viên hiện đang trống."
            }
          />
        </View>
      ) : (
        <View style={styles.list}>
          {members.map((member: MemberSummary) => (
            <MemberCard key={member.id} member={member} />
          ))}
        </View>
      )}

      {/* Nút Xem thêm chỉ hiện khi KHÔNG tìm kiếm và còn dữ liệu để tải */}
      {!isLoading && hasMore && !isSearching ? (
        <View style={styles.loadMoreContainer}>
          {isLoadingMore ? (
            <View style={styles.loadingMoreRow}>
              <ActivityIndicator color={colors.primary} size="small" />
              <Text style={styles.loadingMoreText}>Đang tải thêm...</Text>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Xem thêm thành viên"
              onPress={loadMore}
              hitSlop={12}
              style={({ pressed }) => [styles.loadMoreBtn, pressed && styles.loadMorePressed]}
            >
              <Text style={styles.loadMoreText}>Xem thêm</Text>
            </Pressable>
          )}
        </View>
      ) : null}

      {!isLoading && !hasMore && data.length > 0 && !isSearching ? (
        <Text style={styles.endText}>Đã hiển thị toàn bộ {total} thành viên</Text>
      ) : null}

      <AddMemberModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onCreated={() => {
          setShowAddModal(false);
          reload();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 0,
    backgroundColor: colors.surface,
    gap: 0,
  },
  headerContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
  },
  searchWrapper: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F6F8",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: radius.pill, // Bo tròn tuyệt đối (pill shape) chứ không phải bo góc
    paddingHorizontal: spacing.md,
    height: 42,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    height: "100%",
    fontSize: 14,
    color: colors.text,
    paddingVertical: 0,
  },
  clearBtn: {
    padding: spacing.xs,
  },
  list: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: "#EEF2F6",
  },
  stateContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  errorContainer: { flexGrow: 1 },
  loadMoreContainer: {
    paddingVertical: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  loadMoreBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  loadMorePressed: {
    opacity: 0.6,
  },
  loadMoreText: {
    color: colors.primary, // Màu brand iGen Connect (#00AECA)
    fontSize: 12,
    fontWeight: "700",
  },
  loadingMoreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  loadingMoreText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "600",
  },
  endText: {
    color: colors.muted,
    fontSize: 12,
    textAlign: "center",
    paddingVertical: spacing.md,
  },
});
