import { apiRequest } from "@/services/api";

export type MemberFeeStatus = "unpaid" | "partial" | "overdue" | "paid";
export type FeeMember = { id: string; name: string; email: string };
export type FeePayment = {
  id: string;
  amount: number;
  paidOn: string;
  method: "cash" | "transfer";
  reference: string;
  note: string;
  recordedBy: string;
  recordedAt: string;
  voidedAt?: string;
  voidReason?: string;
};
export type MemberFee = {
  _id: string;
  campaignId?: string;
  memberId: string;
  memberName: string;
  memberEmail: string;
  year: number;
  title: string;
  amount: number;
  dueDate: string;
  note: string;
  paid: number;
  remaining: number;
  status: MemberFeeStatus;
  payments: FeePayment[];
  overpaid?: number;
  notifiedAt?: string;
  emailNotifiedAt?: string;
  checkout?: { bank: string; accountNumber: string; accountName: string; paymentCode: string; amount: number; qrUrl: string } | null;
};
export type CreateMemberFee = { campaignId?: string; year: number; title: string; amount: number; dueDate: string; note: string; memberIds: string[] };
export type ReceiveMemberFee = Pick<FeePayment, "id" | "amount" | "paidOn" | "method" | "reference" | "note">;
export type FeeSePayConfig = { enabled: boolean; bank: string; accountNumber: string; accountName: string; hasApiKey: boolean; issues?: string[]; webhookPath: string };
export type FeeSePayTransaction = { _id: string; transactionId: number; status: "pending" | "review" | "applied" | "ignored"; reason: string; feeId?: string; createdAt?: string; payload: { transferAmount: number; transactionDate: string; gateway: string; accountNumber: string; content: string } };

export const feeService = {
  list: (year: number) => apiRequest<{ data: MemberFee[] }>(`/api/v1/member-fees/?year=${year}`).then((payload) => payload.data || []),
  get: (id: string) => apiRequest<{ data: MemberFee }>(`/api/v1/member-fees/${encodeURIComponent(id)}`).then((payload) => payload.data),
  members: () => apiRequest<{ data: FeeMember[] }>("/api/v1/member-fees/members").then((payload) => payload.data || []),
  create: (body: CreateMemberFee) => apiRequest<{ data: { created: number; skipped: number; notified?: number; notificationFailures?: { feeId: string; message: string }[] } }>("/api/v1/member-fees/", { method: "POST", body: JSON.stringify(body) }).then((payload) => payload.data),
  notify: (id: string) => apiRequest<{ data: MemberFee }>(`/api/v1/member-fees/${encodeURIComponent(id)}/notify`, { method: "POST" }).then((payload) => payload.data),
  receive: (id: string, body: ReceiveMemberFee) => apiRequest<{ data: MemberFee }>(`/api/v1/member-fees/${encodeURIComponent(id)}/payments`, { method: "POST", body: JSON.stringify(body) }).then((payload) => payload.data),
  voidPayment: (feeId: string, paymentId: string, reason: string) => apiRequest<{ data: MemberFee }>(`/api/v1/member-fees/${encodeURIComponent(feeId)}/payments/${encodeURIComponent(paymentId)}/void`, { method: "POST", body: JSON.stringify({ reason }) }).then((payload) => payload.data),
  delete: (id: string) => apiRequest<{ data: { message: string } }>(`/api/v1/member-fees/${encodeURIComponent(id)}`, { method: "DELETE" }).then((payload) => payload.data),
  sepayConfig: () => apiRequest<{ data: FeeSePayConfig }>("/api/v1/member-fees/sepay/config").then((payload) => payload.data),
  transactions: () => apiRequest<{ data: FeeSePayTransaction[] }>("/api/v1/member-fees/sepay/transactions").then((payload) => payload.data || []),
};
