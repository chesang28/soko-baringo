"use client";
import { useRef, useState, useTransition } from "react";
import { setListingPhoto } from "@/app/admin/actions";
import { uploadListingPhoto } from "./PhotoInput";

/** Thumbnail that doubles as a "replace photo" button for an existing listing. */
export function ListingPhotoEditor({ listingId, url, emoji }: { listingId: string; url: string | null; emoji: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(url);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file)); setMsg("");
    start(async () => {
      try {
        const path = await uploadListingPhoto(file);
        const res = await setListingPhoto(listingId, path);
        setMsg(res.ok ? "" : res.message);
      } catch (err) {
        setMsg(err instanceof Error ? err.message : "Upload failed");
      }
    });
  }

  return (
    <div className="shrink-0">
      <button type="button" onClick={() => input.current?.click()} title="Change photo"
              className="relative block h-14 w-14 overflow-hidden rounded-lg bg-gray-100 ring-1 ring-gray-200">
        {preview
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={preview} alt="" className="h-full w-full object-cover" />
          : <span className="flex h-full items-center justify-center text-2xl">{emoji}</span>}
        <span className="absolute inset-x-0 bottom-0 bg-black/50 text-[10px] text-white">{pending ? "…" : "📷"}</span>
      </button>
      {msg && <p className="mt-1 max-w-[8rem] text-[10px] text-red-600">{msg}</p>}
      <input ref={input} type="file" accept="image/*" capture="environment" className="hidden" onChange={onChange} />
    </div>
  );
}
