// Shared between the client uploader (UX — reject before spending upload
// time) and the upload route handler (the real enforcement — never trust
// the client alone). Matches docs/PRD.md §5.

export const PHOTO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "image/webp",
] as const;

export const VIDEO_MIME_TYPES = ["video/mp4", "video/quicktime", "video/webm"] as const;

export const MAX_PHOTO_BYTES = 25 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 1024 * 1024 * 1024;
export const MAX_VIDEO_DURATION_SECONDS = 5 * 60;
export const MAX_VIDEO_LONG_EDGE = 1920;
export const MAX_VIDEO_SHORT_EDGE = 1080;

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

export function extensionForMime(mime: string): string {
  return EXTENSION_BY_MIME[mime] ?? "bin";
}

export function kindForMime(mime: string): "photo" | "video" | null {
  if ((PHOTO_MIME_TYPES as readonly string[]).includes(mime)) return "photo";
  if ((VIDEO_MIME_TYPES as readonly string[]).includes(mime)) return "video";
  return null;
}

export type MediaValidationError = { error: string };

/**
 * Format/size checks only — video resolution/duration need metadata that
 * isn't available from a File alone (see the client uploader, which reads
 * it from the decoded video element before calling this).
 */
export function validateFile(file: { type: string; size: number }): MediaValidationError | null {
  const kind = kindForMime(file.type);
  if (kind === null) {
    return { error: `Unsupported file type: ${file.type || "unknown"}` };
  }
  if (kind === "photo" && file.size > MAX_PHOTO_BYTES) {
    return { error: "Photos must be 25 MB or under." };
  }
  if (kind === "video" && file.size > MAX_VIDEO_BYTES) {
    return { error: "Videos must be 1 GB or under." };
  }
  return null;
}

export function validateVideoMetadata(
  durationSeconds: number,
  width: number,
  height: number,
): MediaValidationError | null {
  if (durationSeconds > MAX_VIDEO_DURATION_SECONDS) {
    return { error: "Videos must be 5 minutes or under." };
  }
  const longEdge = Math.max(width, height);
  const shortEdge = Math.min(width, height);
  if (longEdge > MAX_VIDEO_LONG_EDGE || shortEdge > MAX_VIDEO_SHORT_EDGE) {
    return { error: "Videos must be 1080p or under." };
  }
  return null;
}
