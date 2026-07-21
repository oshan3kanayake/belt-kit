export type AttendanceStatus = "present" | "on_leave";

export interface Attendance {
  id: string;
  employeeId: string;
  branchId: string;
  date: string;
  status: AttendanceStatus;
  note?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}
