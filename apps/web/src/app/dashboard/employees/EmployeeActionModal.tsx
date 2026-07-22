"use client";

import { Modal } from "@/components/ui";

type Props = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  busy?: boolean;
  danger?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export default function EmployeeActionModal({
  open,
  title,
  message,
  confirmLabel,
  busy = false,
  danger = false,
  onClose,
  onConfirm,
}: Props) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="md">
      <div className="space-y-5">
        <p className="font-sans text-sm leading-relaxed text-ink-soft">{message}</p>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`btn-primary ${danger ? "!bg-rose-600 hover:!bg-rose-700" : ""}`}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
