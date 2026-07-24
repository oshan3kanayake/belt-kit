"use client";

type EmployeeOption = {
  id: string;
  label: string;
};

type EmployeeSelectorProps = {
  label: string;
  value: string;
  options: EmployeeOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function EmployeeSelector({ label, value, options, onChange, disabled }: EmployeeSelectorProps) {
  return (
    <label className="flex flex-col gap-1 text-sm text-ink-soft">
      <span className="font-medium text-ink">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="rounded-xl border border-line bg-white px-3 py-2 outline-none focus:border-burgundy-400"
      >
        <option value="">Select employee</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
