import { apiRequest } from "@/services/api";

export type MemberFee = { _id: string; title: string; amount: number; paid: number; remaining: number; dueDate: string; status: "unpaid" | "partial" | "overdue" | "paid"; checkout?: { bank: string; accountNumber: string; accountName: string; paymentCode: string; amount: number; qrUrl: string } | null };

export const feeService = {
  list: (year: number) => apiRequest<{ data: MemberFee[] }>(`/api/v1/member-fees/?year=${year}`).then((payload) => payload.data || []),
  get: (id: string) => apiRequest<{ data: MemberFee }>(`/api/v1/member-fees/${encodeURIComponent(id)}`).then((payload) => payload.data),
};
