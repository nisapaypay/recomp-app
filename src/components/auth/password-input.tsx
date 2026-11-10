"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type ComponentProps } from "react";
import { Field } from "@/components/ui/field";

/** Password field with a show/hide toggle (44px touch target). */
export function PasswordField(props: Omit<ComponentProps<typeof Field>, "type" | "trailing">) {
  const [visible, setVisible] = useState(false);
  return (
    <Field
      {...props}
      type={visible ? "text" : "password"}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="grid size-11 place-items-center rounded-control text-ink-muted hover:text-ink"
        >
          {visible ? <EyeOff aria-hidden className="size-5" /> : <Eye aria-hidden className="size-5" />}
        </button>
      }
    />
  );
}
