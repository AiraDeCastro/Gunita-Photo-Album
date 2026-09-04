export type Role = "owner" | "admin" | "editor" | "viewer";

export type AlbumSummary = {
  id: string;
  title: string;
  description: string | null;
  type: "private" | "shared";
  cover: string | null;
  /** Up to a handful of recent thumbnails, for the card hover-preview cycle. */
  previewUrls: string[];
  itemCount: number;
  role: Role;
  updatedAt: string;
};

export type AlbumMember = {
  userId: string;
  email: string;
  role: Role;
};

export type AlbumDetail = AlbumSummary & {
  members: AlbumMember[];
  /** Raw id behind `cover` (a signed URL) — lets the UI mark which media tile is the current cover. */
  coverMediaId: string | null;
};

export type DeletedAlbum = {
  id: string;
  title: string;
  daysLeft: number;
  deletedAt: string;
};

export const CAN_EDIT: Role[] = ["owner", "admin", "editor"];
export const CAN_MANAGE_MEMBERS: Role[] = ["owner", "admin"];
