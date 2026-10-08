import { useState } from "react";
import * as DocumentPicker from "expo-document-picker";
import { ChevronRight, File, FileText, Folder, MoreVertical, Plus, Upload, X } from "lucide-react-native";
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackHeader } from "@/components/BackHeader";
import { Button, Card, EmptyState, ErrorState, LoadingState, Screen } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { chatService, type ChatRoom } from "@/services/chat";
import { resourceService, type ResourceItem, type ResourceShare } from "@/services/resources";
import { userService } from "@/services/users";
import { colors, radius, spacing, touchTarget } from "@/theme/tokens";
import type { UserProfile } from "@/types";
import { hasPermission } from "@/utils/permissions";

type Dialog = "actions" | "create" | "rename" | "move" | "share" | "confirm" | "message" | null;
type Target = { id: string; type: "user" | "room"; name: string };

export function ResourceManager() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const canManage = hasPermission(user, "resource:manage");
  const [trash, setTrash] = useState(false);
  const [trail, setTrail] = useState<ResourceItem[]>([]);
  const folder = trail.at(-1) || null;
  const { data, error, isLoading, reload } = useAsyncData(
    () => trash ? resourceService.trash() : resourceService.list(folder?._id || null),
    `${trash ? "trash" : "files"}:${folder?._id || "root"}`,
  );
  const [dialog, setDialog] = useState<Dialog>(null);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [selected, setSelected] = useState<ResourceItem | null>(null);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [pickerTrail, setPickerTrail] = useState<ResourceItem[]>([]);
  const [pickerItems, setPickerItems] = useState<ResourceItem[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [shares, setShares] = useState<ResourceShare[]>([]);
  const [search, setSearch] = useState("");

  const currentFolderMutable = !folder || (!folder.isFixed && folder.managedType !== "system" && !folder.isShared);
  const canEdit = (item: ResourceItem) => canManage && !item.isFixed && item.managedType !== "system" && !item.isShared && (user?.role === "admin" || item.creatorUid === user?.uid);
  const showMessage = (text: string) => { setMessage(text); setDialog("message"); };
  const fail = (cause: unknown) => showMessage(cause instanceof Error ? cause.message : "Vui lòng thử lại.");
  const close = () => { if (!busy) setDialog(null); };
  const run = async (action: () => Promise<unknown>, success: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
      await reload();
      showMessage(success);
    } catch (cause) { fail(cause); }
    finally { setBusy(false); }
  };
  const select = (item: ResourceItem) => { setSelected(item); setDialog("actions"); };
  const open = async (item: ResourceItem) => {
    if (item.type === "folder") { setTrail((current) => [...current, item]); return; }
    if (!item.fileUrl) { showMessage("Tài nguyên này chưa có đường dẫn tệp."); return; }
    try { await Linking.openURL(item.fileUrl); } catch (cause) { fail(cause); }
  };
  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      await run(async () => {
        const uploaded = await resourceService.uploadFile(asset);
        await resourceService.createFile(asset.name, uploaded.url, folder?._id || null, asset.mimeType, asset.size);
      }, "Đã tải tệp lên.");
    } catch (cause) { fail(cause); }
  };
  const prepareMove = async () => {
    setPickerTrail([]); setPickerItems([]); setDialog("move"); setBusy(true);
    try { setPickerItems(await resourceService.list()); } catch (cause) { fail(cause); }
    finally { setBusy(false); }
  };
  const enterPicker = async (item: ResourceItem) => {
    setBusy(true);
    try {
      const items = await resourceService.list(item._id);
      setPickerTrail((current) => [...current, item]); setPickerItems(items);
    } catch (cause) { fail(cause); }
    finally { setBusy(false); }
  };
  const backPicker = async () => {
    const next = pickerTrail.slice(0, -1);
    setBusy(true);
    try { setPickerItems(await resourceService.list(next.at(-1)?._id || null)); setPickerTrail(next); }
    catch (cause) { fail(cause); }
    finally { setBusy(false); }
  };
  const prepareShare = async () => {
    if (!selected) return;
    setDialog("share"); setBusy(true); setSearch("");
    try {
      const [currentShares, users, rooms] = await Promise.all([
        resourceService.shares(selected._id), userService.directory(), chatService.rooms().catch(() => []),
      ]);
      setShares(currentShares);
      setTargets([
        ...users.filter((person: UserProfile) => person.uid !== user?.uid).map((person: UserProfile) => ({ id: person.uid, type: "user" as const, name: person.displayName || person.email })),
        ...rooms.filter((room: ChatRoom) => room.isGroup).map((room: ChatRoom) => ({ id: room._id, type: "room" as const, name: room.name || "Nhóm trò chuyện" })),
      ]);
    } catch (cause) { fail(cause); }
    finally { setBusy(false); }
  };
  const toggleShare = (target: Target) => setShares((current) => current.some((share) => share.targetId === target.id && share.targetType === target.type)
    ? current.filter((share) => share.targetId !== target.id || share.targetType !== target.type)
    : [...current, { targetId: target.id, targetType: target.type, targetName: target.name }]);



  return <View style={styles.page}><Screen scrollViewProps={{ keyboardShouldPersistTaps: "handled", contentContainerStyle: { paddingBottom: insets.bottom + 112 } }}>
    <BackHeader title="Tài nguyên" subtitle={trash ? "Tài nguyên đã xóa" : folder?.name || "Tệp và thư mục nội bộ"} compact />
    <View style={styles.tabs}>
      <Pressable accessibilityRole="tab" accessibilityState={{ selected: !trash }} onPress={() => setTrash(false)} style={[styles.tab, !trash && styles.tabActive]}><Text style={[styles.tabText, !trash && styles.tabTextActive]}>Tài nguyên</Text></Pressable>
      <Pressable accessibilityRole="tab" accessibilityState={{ selected: trash }} onPress={() => { setTrail([]); setTrash(true); }} style={[styles.tab, trash && styles.tabActive]}><Text style={[styles.tabText, trash && styles.tabTextActive]}>Thùng rác</Text></Pressable>
    </View>
    {!trash && trail.length ? <View style={styles.crumbs}>
      <Pressable onPress={() => setTrail([])} style={styles.crumb}><Text style={styles.crumbText}>Gốc</Text></Pressable>
      {trail.map((part, index) => <Pressable key={part._id} onPress={() => setTrail(trail.slice(0, index + 1))} style={styles.crumb}><ChevronRight size={14} color={colors.muted} /><Text numberOfLines={1} style={styles.crumbText}>{part.name}</Text></Pressable>)}
    </View> : null}
    {isLoading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={reload} /> : !data?.length ? <EmptyState title={trash ? "Thùng rác trống" : "Thư mục trống"} message={trash ? "Không có tài nguyên đã xóa." : "Chưa có tài nguyên trong thư mục này."} /> : <Card style={styles.list}>
      {data.map((item) => { const Icon = item.type === "folder" ? Folder : item.mimeType?.includes("pdf") ? FileText : File; return <View key={item._id} style={styles.row}>
        <Pressable accessibilityRole="button" onPress={() => trash ? select(item) : void open(item)} style={styles.itemBody}>
          <View style={styles.icon}><Icon color={colors.primaryDark} size={22} strokeWidth={1.9} /></View>
          <View style={styles.grow}><Text numberOfLines={2} style={styles.name}>{item.name}</Text><Text style={styles.meta}>{item.type === "folder" ? "Thư mục" : formatSize(item.size)}{item.isShared ? " · Được chia sẻ" : ""}{item.createdAt ? ` · ${new Date(item.createdAt).toLocaleDateString("vi-VN")}` : ""}</Text></View>
        </Pressable>
        {canEdit(item) ? <Pressable accessibilityLabel={`Tùy chọn ${item.name}`} accessibilityRole="button" onPress={() => select(item)} style={styles.more}><MoreVertical color={colors.muted} size={20} /></Pressable> : item.type === "folder" && !trash ? <ChevronRight color={colors.muted} size={18} /> : null}
      </View>; })}
    </Card>}

    <Modal visible={dialog !== null} transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
      <View style={styles.overlay}><Pressable style={styles.backdrop} onPress={close} /><View accessibilityViewIsModal style={styles.dialog}>
        {dialog === "message" ? <><Text style={styles.dialogTitle}>Thông báo</Text><Text style={styles.description}>{message}</Text><Button onPress={close} fullWidth>Đóng</Button></> : null}
        {dialog === "actions" && selected ? <><Text style={styles.dialogTitle} numberOfLines={2}>{selected.name}</Text>
          {trash ? <><MenuAction label="Khôi phục" onPress={() => void run(() => resourceService.restore(selected._id), "Đã khôi phục tài nguyên.")} /><MenuAction label="Xóa vĩnh viễn" danger onPress={() => setDialog("confirm")} /></> : <>
            <MenuAction label="Mở tài nguyên" onPress={() => { setDialog(null); void open(selected); }} />
            <MenuAction label="Đổi tên" onPress={() => { setName(selected.name); setDialog("rename"); }} />
            <MenuAction label="Di chuyển" onPress={() => void prepareMove()} />
            <MenuAction label="Chia sẻ" onPress={() => void prepareShare()} />
            <MenuAction label="Chuyển vào thùng rác" danger onPress={() => setDialog("confirm")} />
          </>}
          <Button tone="secondary" onPress={close} fullWidth>Đóng</Button>
        </> : null}
        {dialog === "confirm" && selected ? <><Text style={styles.dialogTitle}>{trash ? "Xóa vĩnh viễn?" : "Xóa tài nguyên?"}</Text><Text style={styles.description}>{trash ? `“${selected.name}” sẽ bị xóa vĩnh viễn. Không thể khôi phục.` : `“${selected.name}” sẽ được chuyển vào thùng rác.${selected.type === "folder" ? " Các mục bên trong cũng sẽ được chuyển theo." : ""}`}</Text><View style={styles.buttons}><Button tone="secondary" onPress={() => setDialog("actions")} style={styles.flex}>Hủy</Button><Button tone="danger" disabled={busy} onPress={() => void run(() => resourceService.remove(selected._id), trash ? "Đã xóa vĩnh viễn." : "Đã chuyển vào thùng rác.")} style={styles.flex}>{busy ? "Đang xóa..." : "Xác nhận xóa"}</Button></View></> : null}
        {dialog === "create" || dialog === "rename" ? <><Text style={styles.dialogTitle}>{dialog === "create" ? "Tạo thư mục" : "Đổi tên tài nguyên"}</Text><TextInput autoFocus value={name} onChangeText={setName} placeholder="Nhập tên" placeholderTextColor={colors.muted} maxLength={dialog === "create" ? 200 : 300} style={styles.input} /><View style={styles.buttons}><Button tone="secondary" onPress={close} style={styles.flex}>Hủy</Button><Button disabled={busy || !name.trim()} onPress={() => void run(() => dialog === "create" ? resourceService.createFolder(name.trim(), folder?._id || null) : resourceService.rename(selected!._id, name.trim()), dialog === "create" ? "Đã tạo thư mục." : "Đã đổi tên.")} style={styles.flex}>{busy ? "Đang lưu..." : "Lưu"}</Button></View></> : null}
        {dialog === "move" && selected ? <><Text style={styles.dialogTitle}>Di chuyển “{selected.name}”</Text><Text style={styles.description}>Chọn thư mục đích: {pickerTrail.at(-1)?.name || "Gốc"}</Text>{busy ? <ActivityIndicator color={colors.primary} /> : <ScrollView style={styles.pickerList}>{pickerTrail.length ? <MenuAction label="← Thư mục trước" onPress={() => void backPicker()} /> : null}{pickerItems.filter((item) => item.type === "folder" && item._id !== selected._id && !item.isFixed && item.managedType !== "system" && !item.isShared).map((item) => <MenuAction key={item._id} label={`📁 ${item.name}`} onPress={() => void enterPicker(item)} />)}</ScrollView>}<View style={styles.buttons}><Button tone="secondary" onPress={close} style={styles.flex}>Hủy</Button><Button disabled={busy || pickerTrail.at(-1)?._id === selected.parentId || (!pickerTrail.length && !selected.parentId)} onPress={() => void run(() => resourceService.move(selected._id, pickerTrail.at(-1)?._id || null), "Đã di chuyển tài nguyên.")} style={styles.flex}>Di chuyển vào đây</Button></View></> : null}
        {dialog === "share" && selected ? <><Text style={styles.dialogTitle}>Chia sẻ “{selected.name}”</Text><TextInput value={search} onChangeText={setSearch} placeholder="Tìm thành viên hoặc nhóm" placeholderTextColor={colors.muted} style={styles.input} />{busy ? <ActivityIndicator color={colors.primary} /> : <ScrollView style={styles.pickerList} keyboardShouldPersistTaps="handled">{targets.filter((target) => target.name.toLocaleLowerCase("vi-VN").includes(search.toLocaleLowerCase("vi-VN"))).map((target) => { const checked = shares.some((share) => share.targetId === target.id && share.targetType === target.type); return <Pressable key={`${target.type}:${target.id}`} onPress={() => toggleShare(target)} style={styles.shareRow}><Text style={styles.grow}>{target.type === "room" ? "Nhóm · " : ""}{target.name}</Text><Text style={styles.check}>{checked ? "✓" : "○"}</Text></Pressable>; })}</ScrollView>}<View style={styles.buttons}><Button tone="secondary" onPress={close} style={styles.flex}>Hủy</Button><Button disabled={busy} onPress={() => void run(() => resourceService.updateShares(selected._id, shares), "Đã cập nhật chia sẻ.")} style={styles.flex}>Lưu</Button></View></> : null}
      </View></View>
    </Modal>
  </Screen>
    {!trash && canManage && currentFolderMutable && !createMenuOpen ? <Pressable accessibilityRole="button" accessibilityLabel="Thêm tài nguyên" accessibilityState={{ expanded: false }} onPress={() => setCreateMenuOpen(true)} style={[styles.addButton, { bottom: insets.bottom + spacing.xl }]}><Plus color={colors.primaryDark} size={26} strokeWidth={2.5} /></Pressable> : null}
    {createMenuOpen ? <View accessibilityViewIsModal style={styles.createOverlay}>
      <Pressable accessibilityLabel="Đóng menu thêm tài nguyên" style={styles.createBackdrop} onPress={() => setCreateMenuOpen(false)} />
      <View style={[styles.createMenu, { bottom: insets.bottom + spacing.xl }]}>
        <Pressable accessibilityRole="button" onPress={() => { setCreateMenuOpen(false); void pickFile(); }} style={styles.createOption}><Upload color="#FFFFFF" size={20} /><Text style={styles.createOptionText}>Tải lên</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => { setCreateMenuOpen(false); setName(""); setDialog("create"); }} style={styles.createOption}><Folder color="#FFFFFF" size={20} /><Text style={styles.createOptionText}>Tạo thư mục</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Đóng menu" onPress={() => setCreateMenuOpen(false)} style={styles.createClose}><X color={colors.primaryDark} size={24} strokeWidth={2.5} /></Pressable>
      </View>
    </View> : null}
  </View>;
}

function MenuAction({ label, onPress, danger = false }: { label: string; onPress: () => void; danger?: boolean }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={styles.menuAction}><Text style={[styles.menuText, danger && styles.danger]}>{label}</Text><ChevronRight size={18} color={danger ? colors.danger : colors.muted} /></Pressable>;
}
function formatSize(size?: number) { if (!size) return "Không rõ dung lượng"; if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`; return `${(size / 1024 / 1024).toFixed(1)} MB`; }

const styles = StyleSheet.create({
  page: { flex: 1 },
  addButton: { position: "absolute", right: spacing.lg, width: 56, height: 56, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.primarySoft, elevation: 4, shadowColor: colors.text, shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  createOverlay: { ...StyleSheet.absoluteFill, zIndex: 10 },
  createBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(8, 24, 32, 0.76)" },
  createMenu: { position: "absolute", right: spacing.lg, alignItems: "flex-end", gap: spacing.sm },
  createOption: { minWidth: 190, minHeight: touchTarget, paddingHorizontal: spacing.lg, flexDirection: "row", alignItems: "center", gap: spacing.md, borderRadius: radius.pill, backgroundColor: colors.primaryDark },
  createOptionText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  createClose: { width: 56, height: 56, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.primarySoft },
  tabs: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: 4 }, tab: { minHeight: touchTarget, flex: 1, justifyContent: "center", alignItems: "center", borderRadius: radius.md, backgroundColor: colors.surface }, tabActive: { backgroundColor: colors.primarySoft }, tabText: { color: colors.muted, fontWeight: "700" }, tabTextActive: { color: colors.primaryDark },
  crumbs: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 2, paddingHorizontal: 4 }, crumb: { flexDirection: "row", alignItems: "center", minHeight: 36, maxWidth: 170 }, crumbText: { color: colors.primaryDark, fontSize: 12, fontWeight: "700" },
  list: { paddingVertical: 0 }, row: { minHeight: 70, flexDirection: "row", alignItems: "center", gap: spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, itemBody: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm }, icon: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: colors.primarySoft }, grow: { flex: 1 }, name: { color: colors.text, fontSize: 14, fontWeight: "800" }, meta: { marginTop: 3, color: colors.muted, fontSize: 11 }, more: { width: touchTarget, height: touchTarget, alignItems: "center", justifyContent: "center" },
  overlay: { flex: 1, justifyContent: "center", padding: spacing.lg }, backdrop: { ...(StyleSheet.absoluteFill as object), backgroundColor: colors.overlay }, dialog: { maxHeight: "85%", borderRadius: radius.xl, backgroundColor: colors.surface, padding: spacing.lg, gap: spacing.md }, dialogTitle: { color: colors.text, fontSize: 18, fontWeight: "800" }, description: { color: colors.muted, fontSize: 13, lineHeight: 19 }, buttons: { flexDirection: "row", gap: spacing.sm }, flex: { flex: 1 }, input: { minHeight: touchTarget, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, color: colors.text }, menuAction: { minHeight: touchTarget, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, menuText: { color: colors.text, fontSize: 14, fontWeight: "700" }, danger: { color: colors.danger }, pickerList: { maxHeight: 250 }, shareRow: { minHeight: touchTarget, flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, check: { color: colors.primaryDark, fontSize: 22, fontWeight: "800" },
});
