"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MediaItem } from "@/lib/media/types";
import { deleteMedia } from "@/lib/media/actions";
import {
  PHOTO_MIME_TYPES,
  VIDEO_MIME_TYPES,
  validateFile,
  validateVideoMetadata,
} from "@/lib/media/constraints";
import { readPhotoMetadata, readVideoMetadata } from "@/lib/media/client-thumbnails";

const ACCEPT = [...PHOTO_MIME_TYPES, ...VIDEO_MIME_TYPES].join(",");

type UploadTask = {
  key: string;
  name: string;
  progress: number;
  status: "preparing" | "uploading" | "error";
  error?: string;
};

function uploadWithProgress(
  formData: FormData,
  onProgress: (pct: number) => void,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/media/upload");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let body: { id?: string; error?: string } = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // fall through with an empty body — the status check below handles it
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve({ ok: true });
      else resolve({ ok: false, error: body.error ?? `Upload failed (${xhr.status}).` });
    };
    xhr.onerror = () => resolve({ ok: false, error: "Network error during upload." });
    xhr.send(formData);
  });
}

export default function MediaUploader({
  albumId,
  canUpload,
  media,
}: {
  albumId: string;
  canUpload: boolean;
  media: MediaItem[];
}) {
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function uploadOne(file: File) {
    const key = crypto.randomUUID();
    setTasks((prev) => [...prev, { key, name: file.name, progress: 0, status: "preparing" }]);

    const fileError = validateFile(file);
    if (fileError) {
      setTasks((prev) =>
        prev.map((t) => (t.key === key ? { ...t, status: "error", error: fileError.error } : t)),
      );
      return;
    }

    const isVideo = file.type.startsWith("video/");
    const formData = new FormData();
    formData.set("albumId", albumId);
    formData.set("file", file);

    try {
      if (isVideo) {
        const meta = await readVideoMetadata(file);
        const videoError = validateVideoMetadata(meta.durationSeconds, meta.width, meta.height);
        if (videoError) {
          setTasks((prev) =>
            prev.map((t) => (t.key === key ? { ...t, status: "error", error: videoError.error } : t)),
          );
          return;
        }
        formData.set("width", String(meta.width));
        formData.set("height", String(meta.height));
        formData.set("durationSeconds", String(meta.durationSeconds));
        if (meta.thumbnail) formData.set("thumbnail", meta.thumbnail, "thumb.jpg");
      } else {
        const meta = await readPhotoMetadata(file);
        formData.set("width", String(meta.width));
        formData.set("height", String(meta.height));
        if (meta.thumbnail) formData.set("thumbnail", meta.thumbnail, "thumb.jpg");
      }
    } catch (e) {
      setTasks((prev) =>
        prev.map((t) =>
          t.key === key
            ? { ...t, status: "error", error: e instanceof Error ? e.message : "Could not read that file." }
            : t,
        ),
      );
      return;
    }

    setTasks((prev) => prev.map((t) => (t.key === key ? { ...t, status: "uploading" } : t)));
    const result = await uploadWithProgress(formData, (pct) =>
      setTasks((prev) => prev.map((t) => (t.key === key ? { ...t, progress: pct } : t))),
    );

    if (result.ok) {
      setTasks((prev) => prev.filter((t) => t.key !== key));
      router.refresh();
    } else {
      setTasks((prev) =>
        prev.map((t) => (t.key === key ? { ...t, status: "error", error: result.error } : t)),
      );
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach((file) => void uploadOne(file));
  }

  function dismissTask(key: string) {
    setTasks((prev) => prev.filter((t) => t.key !== key));
  }

  const isEmpty = media.length === 0 && tasks.length === 0;

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-mono text-sm uppercase tracking-wide text-text-muted">Media</h2>
        {canUpload && (
          <>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ACCEPT}
              onChange={(e) => {
                handleFiles(e.target.files);
                e.target.value = "";
              }}
              className="sr-only"
              aria-label="Choose photos or videos to upload"
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-md border border-border px-4 py-2 text-sm text-text hover:bg-surface-sunken transition-colors"
            >
              Upload
            </button>
          </>
        )}
      </div>

      <div
        onDragOver={
          canUpload
            ? (e) => {
                e.preventDefault();
                setDragging(true);
              }
            : undefined
        }
        onDragLeave={canUpload ? () => setDragging(false) : undefined}
        onDrop={
          canUpload
            ? (e) => {
                e.preventDefault();
                setDragging(false);
                handleFiles(e.dataTransfer.files);
              }
            : undefined
        }
        className={`rounded-md transition-colors ${dragging ? "bg-accent-soft" : ""}`}
      >
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border py-20 text-center">
            <p className="text-sm text-text-muted">Nothing here yet.</p>
            {canUpload && (
              <p className="text-xs text-text-faint">Drag photos or videos here, or use Upload.</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {media.map((item) => (
              <MediaTile
                key={item.id}
                item={item}
                albumId={albumId}
                canDelete={canUpload}
              />
            ))}
            {tasks.map((task) => (
              <UploadTile key={task.key} task={task} onDismiss={() => dismissTask(task.key)} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function MediaTile({
  item,
  albumId,
  canDelete,
}: {
  item: MediaItem;
  albumId: string;
  canDelete: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="group relative aspect-square overflow-hidden rounded-md bg-surface-sunken">
      {item.thumbnailUrl ? (
        <Image
          src={item.thumbnailUrl}
          alt=""
          fill
          sizes="200px"
          className="object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <span className="font-mono text-[10px] uppercase tracking-wide text-text-faint">
            {item.kind}
          </span>
        </div>
      )}
      {item.kind === "video" && (
        <span className="absolute bottom-2 left-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-mono text-white">
          {formatDuration(item.durationSeconds)}
        </span>
      )}
      {canDelete && (
        <div className="absolute inset-0 flex items-start justify-end p-2 opacity-0 transition-opacity group-hover:opacity-100">
          {confirming ? (
            <div className="flex gap-1 rounded-md bg-black/70 p-1">
              <button
                type="button"
                disabled={pending}
                onClick={() => startTransition(() => deleteMedia(albumId, item.id))}
                className="rounded bg-danger px-2 py-1 text-[10px] font-medium text-danger-ink"
              >
                {pending ? "…" : "Delete"}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded px-2 py-1 text-[10px] text-white"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              aria-label="Delete"
              className="rounded-full bg-black/50 px-2 py-1 text-[10px] text-white hover:bg-black/70"
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function UploadTile({ task, onDismiss }: { task: UploadTask; onDismiss: () => void }) {
  return (
    <div className="relative flex aspect-square flex-col items-center justify-center gap-2 rounded-md border border-border bg-surface p-3 text-center">
      <p className="w-full truncate text-xs text-text-muted">{task.name}</p>
      {task.status === "error" ? (
        <>
          <p className="text-xs text-danger" role="alert">
            {task.error}
          </p>
          <button
            type="button"
            onClick={onDismiss}
            className="text-xs text-text-faint hover:text-text transition-colors"
          >
            Dismiss
          </button>
        </>
      ) : (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
          <div
            className="h-full bg-accent transition-all"
            style={{ width: `${task.status === "preparing" ? 5 : task.progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
