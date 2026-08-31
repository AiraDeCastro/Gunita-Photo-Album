export type Role = "owner" | "admin" | "editor" | "viewer";

export type Album = {
  id: string;
  title: string;
  cover: string;
  itemCount: number;
  type: "private" | "shared";
  members?: { name: string; role: Role }[];
  updatedAt: string;
};

export const albums: Album[] = [
  {
    id: "baguio-summer",
    title: "Summer in Baguio",
    cover: "/samples/lake.jpg",
    itemCount: 42,
    type: "shared",
    members: [
      { name: "You", role: "owner" },
      { name: "Mira", role: "editor" },
      { name: "Dad", role: "viewer" },
    ],
    updatedAt: "2026-08-24",
  },
  {
    id: "beach-weekend",
    title: "Beach Weekend",
    cover: "/samples/ocean.jpg",
    itemCount: 18,
    type: "private",
    updatedAt: "2026-08-20",
  },
  {
    id: "lake-house",
    title: "Lake House",
    cover: "/samples/lake2.jpg",
    itemCount: 27,
    type: "shared",
    members: [
      { name: "You", role: "owner" },
      { name: "Nico", role: "admin" },
    ],
    updatedAt: "2026-08-12",
  },
  {
    id: "family-reunion",
    title: "Family Reunion",
    cover: "/samples/photoalbum.jpeg",
    itemCount: 63,
    type: "shared",
    members: [
      { name: "You", role: "editor" },
      { name: "Tita Rose", role: "owner" },
    ],
    updatedAt: "2026-07-30",
  },
  {
    id: "old-photos",
    title: "Old Photos",
    cover: "/samples/photoalbum2.jpg",
    itemCount: 9,
    type: "private",
    updatedAt: "2026-07-02",
  },
  {
    id: "sunset-drive",
    title: "Sunset Drive",
    cover: "/samples/lake3.jpeg",
    itemCount: 12,
    type: "private",
    updatedAt: "2026-06-18",
  },
  {
    id: "kids-first-year",
    title: "Kid's First Year",
    cover: "/samples/photoalbum3.jpg",
    itemCount: 210,
    type: "shared",
    members: [
      { name: "You", role: "owner" },
      { name: "Partner", role: "admin" },
      { name: "Lola", role: "viewer" },
    ],
    updatedAt: "2026-05-11",
  },
];

export const featured = albums[0];

export const rows: { label: string; albums: Album[] }[] = [
  { label: "Recently added", albums: albums.slice(0, 5) },
  { label: "Shared with family & friends", albums: albums.filter((a) => a.type === "shared") },
  { label: "All albums", albums },
];
