// Browser-only helpers: read dimensions/duration and draw a thumbnail
// before upload, so the server never has to decode media itself (no
// ffmpeg/sharp dependency — see PLANNING.md's Supabase Storage entry).

const THUMB_MAX_DIMENSION = 480;

function drawThumbnail(
  source: CanvasImageSource,
  width: number,
  height: number,
): Promise<Blob | null> {
  const scale = Math.min(1, THUMB_MAX_DIMENSION / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.82));
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read that image."));
    img.src = src;
  });
}

export type PhotoMetadata = { width: number; height: number; thumbnail: Blob | null };

export async function readPhotoMetadata(file: File): Promise<PhotoMetadata> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const { naturalWidth: width, naturalHeight: height } = img;
    // HEIC in particular often can't be canvas-drawn in Chromium/Firefox —
    // treat that as "no thumbnail", not a failed upload.
    const thumbnail = await drawThumbnail(img, width, height).catch(() => null);
    return { width, height, thumbnail };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export type VideoMetadata = {
  width: number;
  height: number;
  durationSeconds: number;
  thumbnail: Blob | null;
};

export async function readVideoMetadata(file: File): Promise<VideoMetadata> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.src = url;

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Could not read that video."));
    });

    const { videoWidth: width, videoHeight: height, duration: durationSeconds } = video;

    const thumbnail = await new Promise<Blob | null>((resolve) => {
      video.onseeked = () => drawThumbnail(video, width, height).then(resolve).catch(() => resolve(null));
      video.currentTime = Math.min(0.1, video.duration || 0);
    }).catch(() => null);

    return { width, height, durationSeconds, thumbnail };
  } finally {
    URL.revokeObjectURL(url);
  }
}
