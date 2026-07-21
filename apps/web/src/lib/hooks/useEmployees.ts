"use client";

import { useEffect, useState, useCallback } from "react";
import employeeService from "../services/employeeService";
import { Employee } from "../models";
import { useAuth } from "../auth-context";

export function useEmployees() {
  const { role, roleResolved } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await employeeService.getEmployees();
      setEmployees(res.employees ?? []);
    } catch (err: unknown) {
      const msg = (err as { message?: string; code?: string })?.message ?? "Failed to load employees.";
      setError(msg);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!roleResolved) {
      setLoading(true);
      return;
    }
    // Only owners/managers may view employees — short-circuit if not allowed.
    if (!(role === "owner" || role === "manager")) {
      setEmployees([]);
      setLoading(false);
      setError(null);
      return;
    }

    void fetch();
  }, [role, roleResolved, fetch]);

  const refresh = useCallback(() => fetch(), [fetch]);

  return { employees, loading, error, refresh } as const;
}

export default useEmployees;
