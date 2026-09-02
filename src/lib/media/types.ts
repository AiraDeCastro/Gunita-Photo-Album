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

export type DeletedMediaItem = {
  id: string;
  albumId: string;
  albumTitle: string;
  kind: "photo" | "video";
  daysLeft: number;
  deletedAt: string;
};
