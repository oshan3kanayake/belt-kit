export type Supplier = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  branchId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdByUid?: string;
};

export type PurchaseOrderItem = {
  name: string;
  quantity: number;
  cost: number;
};

export type CreateSupplierPayload = {
  name: string;
  phone?: string;
  email?: string;
};

export type CreatePurchaseOrderPayload = {
  supplierId: string;
  items: PurchaseOrderItem[];
  orderDate: string;
};

export type CreateSupplierPaymentPayload = {
  supplierId: string;
  amount: number;
  paymentDate: string;
  note?: string;
};

export type SupplierSummaryResponse = {
  success: boolean;
  supplierId: string;
  supplierName?: string;
  totalPurchased: number;
  totalPaid: number;
  outstanding: number;
};

export type SupplierListResponse = { success: boolean; suppliers: Supplier[] };
export type CreateSupplierResponse = { success: boolean; supplierId: string };
export type CreatePurchaseOrderResponse = { success: boolean; purchaseOrderId: string };
export type CreateSupplierPaymentResponse = { success: boolean; paymentId: string };
