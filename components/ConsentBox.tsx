/** Required consent checkbox (Kenya Data Protection Act 2019). Server actions also verify it. */
export function ConsentBox({ text, id }: { text: string; id: string }) {
  return (
    <label htmlFor={id} className="flex items-start gap-2 text-xs text-gray-600">
      <input id={id} type="checkbox" name="consent" required className="mt-0.5 h-4 w-4 shrink-0 accent-brand-700" />
      <span>{text} <a href="/privacy" target="_blank" className="text-brand-700 underline">Privacy</a></span>
    </label>
  );
}
