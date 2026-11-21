"use client";
import { useActionState } from "react";
import { requestFarmerVisit } from "@/app/sell/actions";
import { CheckIcon } from "./Icons";
import { SubmitButton } from "./SubmitButton";

export function FarmerLeadForm() {
  const [state, action] = useActionState(requestFarmerVisit, null);

  if (state?.ok) {
    return (
      <div className="flex flex-col items-center py-6 text-center" role="status">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-brand-700"><CheckIcon className="h-8 w-8" /></div>
        <p className="mt-3 text-lg font-semibold text-gray-900">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <div><label className="label" htmlFor="lead-name">Your name</label><input className="input" id="lead-name" name="name" required minLength={2} /></div>
      <div><label className="label" htmlFor="lead-phone">Phone number</label><input className="input" id="lead-phone" name="phone" type="tel" inputMode="tel" placeholder="0712 345 678" required /></div>
      <div><label className="label" htmlFor="lead-ward">Ward / village</label><input className="input" id="lead-ward" name="ward" required placeholder="e.g. Kabartonjo" /></div>
      <div><label className="label" htmlFor="lead-produce">What do you grow?</label><input className="input" id="lead-produce" name="produce" placeholder="e.g. Mangoes, honey" /></div>
      {state && !state.ok && <p role="alert" className="text-sm text-red-700 sm:col-span-2">{state.message}</p>}
      <div className="sm:col-span-2"><SubmitButton className="btn w-full py-3">Ask an agent to visit me</SubmitButton></div>
    </form>
  );
}
