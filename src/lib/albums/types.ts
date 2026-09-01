export type Role = "owner" | "admin" | "editor" | "viewer";

export type AlbumSummary = {
  id: string;
  title: string;
  description: string | null;
  type: "private" | "shared";
  cover: string | null;
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
};

export const CAN_EDIT: Role[] = ["owner", "admin", "editor"];
export const CAN_MANAGE_MEMBERS: Role[] = ["owner", "admin"];
