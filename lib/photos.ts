export const PHOTO_BUCKET = "listing-photos";
export const PHOTO_PATH_RE = /^listings\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

export const photoUrl = (path: string | null | undefined) =>
  path ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PHOTO_BUCKET}/${path}` : null;
