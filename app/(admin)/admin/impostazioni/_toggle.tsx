"use client";

import { useState, useTransition } from "react";
import { InputSwitch } from "primereact/inputswitch";
import { useAppToast } from "@/components/toast-provider";

type Props = {
  initialValue: boolean;
  action: (value: boolean) => Promise<{ error?: string }>;
  label: string;
  onText: string;
  offText: string;
  onToast: string;
  offToast: string;
  onColor?: string;
};

export default function SettingToggle({
  initialValue,
  action,
  label,
  onText,
  offText,
  onToast,
  offToast,
  onColor = "#16A34A",
}: Props) {
  const [value, setValue] = useState(initialValue);
  const [pending, startTransition] = useTransition();
  const { success, error } = useAppToast();

  function handleChange(newValue: boolean) {
    const prev = value;
    setValue(newValue);
    startTransition(async () => {
      const result = await action(newValue);
      if (result?.error) {
        error(result.error);
        setValue(prev);
      } else {
        success(newValue ? onToast : offToast);
      }
    });
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {label}
        </p>
        <p className="text-xs mt-0.5" style={{ color: value ? onColor : "var(--text-muted)" }}>
          {value ? onText : offText}
        </p>
      </div>
      <InputSwitch
        checked={value}
        onChange={(e) => handleChange(e.value ?? false)}
        disabled={pending}
        className="shrink-0"
      />
    </div>
  );
}
