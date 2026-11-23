"use client";
import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PHOTO_BUCKET } from "@/lib/photos";

const MAX_EDGE = 1600;

/** Downscale on the phone before upload: saves data and storage on rural connections. */
async function compress(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not process image"))), "image/jpeg", 0.8),
  );
}

export async function uploadListingPhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose a photo.");
  const blob = await compress(file);
  const path = `listings/${crypto.randomUUID()}.jpg`;
  const { error } = await createClient().storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

/** File picker that uploads immediately and puts the storage path in a hidden form field. */
export function PhotoInput({ name = "photo_path", onUploaded }: { name?: string; onUploaded?: (path: string) => void }) {
  const [path, setPath] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("uploading"); setError("");
    setPreview(URL.createObjectURL(file));
    try {
      const p = await uploadListingPhoto(file);
      setPath(p); setStatus("idle"); onUploaded?.(p);
    } catch (err) {
      setStatus("error"); setError(err instanceof Error ? err.message : "Upload failed"); setPath("");
    }
  }

  return (
    <div>
      <input type="hidden" name={name} value={path} />
      <div className="flex items-center gap-3">
        {preview
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={preview} alt="" className="h-16 w-16 rounded-lg object-cover ring-1 ring-gray-200" />
          : <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-gray-100 text-2xl" aria-hidden="true">📷</div>}
        <div className="text-sm">
          <button type="button" className="btn-ghost" onClick={() => input.current?.click()} disabled={status === "uploading"}>
            {status === "uploading" ? "Uploading…" : preview ? "Change photo" : "Take / choose photo"}
          </button>
          {path && <p className="mt-1 text-xs text-brand-700">✓ Photo uploaded</p>}
          {status === "error" && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
      </div>
      <input ref={input} type="file" accept="image/*" capture="environment" className="hidden" onChange={onChange} />
    </div>
  );
}
