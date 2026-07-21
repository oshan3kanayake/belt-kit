"use client";

import { httpsCallable } from "firebase/functions";
import { auth, functions } from "../firebase";
import type { Attendance, AttendanceStatus } from "../types/attendance";

type CreateAttendancePayload = {
  employeeId: string;
  date: string;
  status: AttendanceStatus;
  note?: string;
};

type GetAttendanceListPayload = {
  employeeId?: string;
  month?: string;
};

type AttendanceSummaryResponse = {
  success: boolean;
  employeeId: string;
  month: string;
  presentDays: number;
  leaveDays: number;
  totalDays: number;
};

async function ensureAuthenticatedCallable() {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("No authenticated user available for attendance update.");
  }

  console.log("[attendance] auth.currentUser", user);
  const tokenResult = await user.getIdTokenResult(true);
  console.log("[attendance] refreshed token result", tokenResult);
  console.log("[attendance] token claims", tokenResult.claims);
  return user;
}

export async function createAttendance(payload: CreateAttendancePayload) {
  await ensureAuthenticatedCallable();
  const fn = httpsCallable(functions, "createAttendance");
  const res = await fn(payload);
  return res.data as { success: boolean; attendanceId?: string };
}

export async function getAttendanceList(params: GetAttendanceListPayload = {}) {
  await ensureAuthenticatedCallable();
  const fn = httpsCallable(functions, "getAttendanceList");
  const res = await fn(params);
  return res.data as { success: boolean; attendance: Attendance[] };
}

export async function getAttendanceSummary(employeeId: string, month: string) {
  await ensureAuthenticatedCallable();
  const fn = httpsCallable(functions, "getAttendanceSummary");
  const res = await fn({ employeeId, month });
  return res.data as AttendanceSummaryResponse;
}

export default {
  createAttendance,
  getAttendanceList,
  getAttendanceSummary,
};
