import * as SecureStore from "expo-secure-store";
import { apiRequest } from "@/services/api";

const RECEIPT_KEY = "igen_account_deletion_receipt";
let memoryReceipt: string | null = null;
export type DeletionOptions = { requiresTransfer: boolean; archivesChapter: boolean; successors: { id: string; name: string; role: string }[] };
export type DeletionStatus = { state: "pending" | "processing" | "completed"; requestedAt: string; completedAt?: string };

export const accountDeletion = {
  options: () => apiRequest<{ data: DeletionOptions }>("/api/v1/auth/me/deletion-options").then((result) => result.data),
  async saveReceipt(receipt: string) {
    memoryReceipt = receipt;
    await SecureStore.setItemAsync(RECEIPT_KEY, receipt).catch(() => undefined);
  },
  async receipt() { return memoryReceipt || await SecureStore.getItemAsync(RECEIPT_KEY); },
  status: (receipt: string) => apiRequest<{ data: DeletionStatus }>("/api/v1/auth/account-deletion-status", { headers: { "X-Deletion-Token": receipt } }).then((result) => result.data),
};
