"use client";

import { CalendarCheck2 } from "lucide-react";
import { PageHeader, EmptyState, CenterSpinner } from "@/components/ui";
import { AttendanceTab } from "@/components/attendance/AttendanceTab";
import { useAuth } from "@/lib/auth-context";

export default function AttendancePage() {
  const { role, roleResolved } = useAuth();
  const unauthorized = !(role === "owner" || role === "manager");

  if (!roleResolved) {
    return <CenterSpinner label="Checking access" />;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeader eyebrow="Operations" title="Employee Attendance" icon={CalendarCheck2} />

      {unauthorized ? (
        <EmptyState title="Not authorized" hint="Only owners and managers can access attendance reporting." />
      ) : (
        <AttendanceTab />
      )}
    </div>
  );
}
