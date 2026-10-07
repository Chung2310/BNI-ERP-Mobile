import type { MemberFee, MemberFeeStatus } from "@/services/fees";

export const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
export const feeStatusLabel: Record<MemberFeeStatus, string> = { unpaid: "Chưa đóng", partial: "Đóng một phần", overdue: "Quá hạn", paid: "Đã đóng" };
export const feeStatusTone = (status: MemberFeeStatus) => status === "paid" ? "primary" as const : status === "overdue" ? "danger" as const : "warning" as const;
export const formatDate = (value?: string) => value ? new Date(value).toLocaleDateString("vi-VN") : "—";
export const normalizeFeeTitle = (value: string) => value.trim().toLocaleLowerCase("vi-VN").replace(/\s+/g, " ");
export const feeCampaignKey = (fee: MemberFee) => fee.campaignId || `${fee.year}_${normalizeFeeTitle(fee.title)}`;
export type FeeCampaign = { key: string; campaignId?: string; year: number; title: string; amount: number; dueDate: string; note: string; items: MemberFee[]; paid: number; total: number; remaining: number };
export function groupFeeCampaigns(items: MemberFee[]) {
  const groups = new Map<string, MemberFee[]>();
  items.forEach((fee) => groups.set(feeCampaignKey(fee), [...(groups.get(feeCampaignKey(fee)) || []), fee]));
  return [...groups.entries()].map(([key, rows]): FeeCampaign => {
    const first = rows[0]; const total = rows.reduce((sum, item) => sum + item.amount, 0); const paid = rows.reduce((sum, item) => sum + item.paid, 0);
    return { key, campaignId: first.campaignId, year: first.year, title: first.title, amount: first.amount, dueDate: first.dueDate, note: first.note, items: rows, total, paid, remaining: Math.max(0, total - paid) };
  });
}
