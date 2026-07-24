"use client";

import { httpsCallable } from "firebase/functions";
import { auth, functions } from "@/lib/firebase";
import type {
  CreatePurchaseOrderPayload,
  CreatePurchaseOrderResponse,
  CreateSupplierPaymentPayload,
  CreateSupplierPaymentResponse,
  CreateSupplierPayload,
  CreateSupplierResponse,
  SupplierListResponse,
  SupplierSummaryResponse,
} from "../types/supplierTypes";

async function ensureAuthenticatedCallable() {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("No authenticated user available for supplier management.");
  }

  await user.getIdTokenResult(true);
  return user;
}

export async function createSupplier(payload: CreateSupplierPayload) {
  await ensureAuthenticatedCallable();
  const fn = httpsCallable(functions, "createSupplier");
  const res = await fn(payload);
  return res.data as CreateSupplierResponse;
}

export async function getSupplierList() {
  await ensureAuthenticatedCallable();
  const fn = httpsCallable(functions, "getSupplierList");
  const res = await fn({});
  return res.data as SupplierListResponse;
}

export async function createPurchaseOrder(payload: CreatePurchaseOrderPayload) {
  await ensureAuthenticatedCallable();
  const fn = httpsCallable(functions, "createPurchaseOrder");
  const res = await fn(payload);
  return res.data as CreatePurchaseOrderResponse;
}

export async function createSupplierPayment(payload: CreateSupplierPaymentPayload) {
  await ensureAuthenticatedCallable();
  const fn = httpsCallable(functions, "createSupplierPayment");
  const res = await fn(payload);
  return res.data as CreateSupplierPaymentResponse;
}

export async function getSupplierSummary(supplierId: string) {
  await ensureAuthenticatedCallable();
  const fn = httpsCallable(functions, "getSupplierSummary");
  const res = await fn({ supplierId });
  return res.data as SupplierSummaryResponse;
}

const supplierService = {
  createSupplier,
  getSupplierList,
  createPurchaseOrder,
  createSupplierPayment,
  getSupplierSummary,
};

export default supplierService;
