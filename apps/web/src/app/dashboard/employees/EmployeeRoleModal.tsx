"use client";

import { useEffect, useState } from "react";
import { Field, Modal } from "@/components/ui";
import { Role } from "@/lib/auth-context";
import { ROLE_META } from "@/lib/roles";

type Props = {
  open: boolean;
  employeeName?: string;
  currentRole?: Role;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (role: Role) => void;
};

const ROLE_OPTIONS: Role[] = ["manager", "advisor", "technician", "accountant"];

export default function EmployeeRoleModal({ open, employeeName, currentRole, busy = false, onClose, onSubmit }: Props) {
  const [selectedRole, setSelectedRole] = useState<Role>(currentRole ?? "technician");

  useEffect(() => {
    if (open) {
      setSelectedRole(currentRole ?? "technician");
    }
  }, [currentRole, open]);

  return (
    <Modal open={open} onClose={onClose} title="Change role" size="md">
      <div className="space-y-4">
        <p className="font-sans text-sm text-ink-soft">
          Update the role for {employeeName || "this employee"}.
        </p>

        <Field label="Role" required>
          <select value={selectedRole} onChange={(ev) => setSelectedRole(ev.target.value as Role)} className="input-luxe">
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>
                {ROLE_META[role]?.label ?? role}
              </option>
            ))}
          </select>
        </Field>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button type="button" disabled={busy} onClick={() => onSubmit(selectedRole)} className="btn-primary">
            {busy ? "Saving…" : "Save role"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
