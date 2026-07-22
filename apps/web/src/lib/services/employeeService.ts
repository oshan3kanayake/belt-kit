"use client";

/**
 * Employee service — wrappers around Firebase callable functions.
 * Keeps business logic and error mapping out of UI components.
 */

import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import { Employee, EmployeePayment } from "../models";
import { Role } from "../auth-context";

type CreateEmployeeParams = {
  fullName: string;
  email: string;
  password: string;
  role: Role;
  phone?: string;
  salaryMinor?: number;
  joinDate?: string; // ISO date or null
  branchId?: string;
};

type UpdateEmployeeParams = {
  employeeId: string;
  updates?: {
    fullName?: string;
    phone?: string;
    salaryMinor?: number;
    joinDate?: string | null;
    active?: boolean;
    archived?: boolean;
  };
};

type AssignRoleParams = { employeeId: string; role: Role; branchId?: string };

type CreatePaymentParams = {
  employeeId: string;
  month: string; // e.g. "2026-07"
  amountPaidMinor: number;
  paidDate?: string | null; // ISO date
};

/** Create a new employee (wraps callable `createEmployee`). */
export async function createEmployee(params: CreateEmployeeParams) {
  try {
    const fn = httpsCallable(functions, "createEmployee");
    const res = await fn(params);
    return res.data as { ok?: boolean; employee?: Employee; uid?: string };
  } catch (err) {
    throw err;
  }
}

/** Update an existing employee (wraps callable `updateEmployee`). */
export async function updateEmployee(params: UpdateEmployeeParams) {
  try {
    const fn = httpsCallable(functions, "updateEmployee");
    const res = await fn(params);
    return res.data as { ok?: boolean; employee?: Employee };
  } catch (err) {
    throw err;
  }
}

/** Assign or change an employee's role (wraps callable `assignEmployeeRole`). */
export async function assignEmployeeRole(params: AssignRoleParams) {
  try {
    const fn = httpsCallable(functions, "assignEmployeeRole");
    const res = await fn(params);
    return res.data as { ok?: boolean };
  } catch (err) {
    throw err;
  }
}

/** Fetch employees (wraps callable `getEmployees`). */
export async function getEmployees() {
  try {
    const fn = httpsCallable(functions, "getEmployees");
    const res = await fn({});
    return res.data as { employees: Employee[] };
  } catch (err) {
    throw err;
  }
}

/** Create an employee payment (wraps callable `createEmployeePayment`). */
export async function createEmployeePayment(params: CreatePaymentParams) {
  try {
    const fn = httpsCallable(functions, "createEmployeePayment");
    const payload = {
      ...params,
      amountPaidMinor: params.amountPaidMinor,
    };
    const res = await fn(payload);
    return res.data as { ok?: boolean; payment?: EmployeePayment };
  } catch (err) {
    throw err;
  }
}

/** Get payments for an employee (wraps callable `getEmployeePayments`). */
export async function getEmployeePayments(employeeId: string) {
  try {
    const fn = httpsCallable(functions, "getEmployeePayments");
    const res = await fn({ employeeId });
    return res.data as { payments: EmployeePayment[] };
  } catch (err) {
    throw err;
  }
}

/** Get payment history / aggregated view (wraps callable `getEmployeePaymentHistory`). */
export async function getEmployeePaymentHistory(employeeId: string) {
  try {
    const fn = httpsCallable(functions, "getEmployeePaymentHistory");
    const res = await fn({ employeeId });
    const data = res.data as {
      history?: EmployeePayment[];
      payments?: EmployeePayment[];
      totalPaidMinor?: number;
    };
    return {
      history: data.history ?? data.payments ?? [],
      payments: data.payments ?? data.history ?? [],
      totalPaidMinor: data.totalPaidMinor,
    };
  } catch (err) {
    throw err;
  }
}

export default {
  createEmployee,
  updateEmployee,
  assignEmployeeRole,
  getEmployees,
  createEmployeePayment,
  getEmployeePayments,
  getEmployeePaymentHistory,
};
