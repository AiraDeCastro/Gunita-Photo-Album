export type MediaItem = {
  id: string;
  kind: "photo" | "video";
  url: string | null;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  bytes: number;
  createdAt: string;
};
