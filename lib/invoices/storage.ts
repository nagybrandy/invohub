// lib/invoices/storage.ts
// Persist invoices in AsyncStorage (device-local, no server sync).

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Invoice } from "@/lib/invoices/types";

const STORAGE_KEY = "@invohub/invoices";

export async function getInvoices(): Promise<Invoice[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as Invoice[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveInvoice(invoice: Invoice): Promise<Invoice> {
  const invoices = await getInvoices();
  const index = invoices.findIndex((item) => item.id === invoice.id);
  const next = [...invoices];
  if (index >= 0) {
    next[index] = invoice;
  } else {
    next.unshift(invoice);
  }
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return invoice;
}

export async function deleteInvoice(id: string): Promise<void> {
  const invoices = await getInvoices();
  const next = invoices.filter((item) => item.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
