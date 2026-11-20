"use client";
import { useActionState, useEffect, useRef } from "react";
import type { FormState } from "@/lib/types";

type Props = {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
};

/** Wraps a server action: shows success/error message and optionally resets on success. */
export function ActionForm({ action, children, className, resetOnSuccess = true }: Props) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      {state && (
        <p role="status" className={`mt-3 text-sm ${state.ok ? "text-brand-700" : "text-red-600"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}
