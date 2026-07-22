"use client";

import { CalendarCheck2 } from "lucide-react";
import { PageHeader, EmptyState, CenterSpinner } from "@/components/ui";
import { AttendanceTab } from "@/components/attendance/AttendanceTab";
import { useAuth } from "@/lib/auth-context";
import { useSearchParams } from "next/navigation";

export default function AttendancePage() {
  const { role, roleResolved } = useAuth();
  const searchParams = useSearchParams();
  const unauthorized = !(role === "owner" || role === "manager" || role === "advisor");

  if (!roleResolved) {
    return <CenterSpinner label="Checking access" />;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeader eyebrow="Operations" title="Employee Attendance" icon={CalendarCheck2} />
      <p className="-mt-2 text-sm text-ink-soft">Record daily status, find unmarked employees, review history, and prepare attendance reports.</p>

      {unauthorized ? (
        <EmptyState title="Not authorized" hint="Only owners, managers, and front-desk advisors can access attendance reporting." />
      ) : (
        <AttendanceTab
          initialDate={searchParams.get("date") ?? undefined}
          initialEmployeeId={searchParams.get("employeeId") ?? undefined}
        />
      )}
    </div>
  );
}
