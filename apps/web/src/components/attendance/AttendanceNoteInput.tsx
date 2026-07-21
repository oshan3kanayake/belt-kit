"use client";

import { useState } from "react";

type AttendanceNoteInputProps = {
  value: string;
  onSave: (note: string) => void;
  loading?: boolean;
};

export function AttendanceNoteInput({ value, onSave, loading }: AttendanceNoteInputProps) {
  const [note, setNote] = useState(value);

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-ink">Special note</label>
      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Add a note for this attendance entry"
        rows={3}
        className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-burgundy-400"
        disabled={loading}
      />
      <button
        type="button"
        onClick={() => onSave(note)}
        className="btn-ghost"
        disabled={loading}
      >
        {loading ? "Saving…" : "Save note"}
      </button>
    </div>
  );
}
