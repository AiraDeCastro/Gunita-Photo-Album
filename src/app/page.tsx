import Navbar from "@/components/Navbar";
import Landing from "@/components/Landing";
import BrowseHome from "@/components/BrowseHome";
import CreateAlbumForm from "@/components/albums/CreateAlbumForm";
import { getAlbumsForCurrentUser } from "@/lib/albums/queries";
import { createClient } from "@/lib/supabase/server";

export default async function BrowsePage() {
  // "/" is a public route (src/lib/supabase/middleware.ts) precisely so a
  // signed-out visitor lands here instead of /sign-in — this is the branch
  // that decides which of the two very different pages they actually see.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex-1">
        <Navbar />
        <Landing />
      </div>
    );
  }

  const albums = await getAlbumsForCurrentUser();

  if (albums.length === 0) {
    return (
      <div className="flex-1">
        <Navbar />
        <div className="flex flex-col items-center justify-center gap-4 px-6 py-24 text-center">
          <h1 className="font-display text-3xl font-medium text-text">No albums yet</h1>
          <p className="max-w-sm text-sm text-text-muted">
            Create your first album to start building a memory worth revisiting.
          </p>
          <CreateAlbumForm />
        </div>
      </div>
    );
  }

  // getAlbumsForCurrentUser already returns albums sorted by real activity
  // (max of updated_at and latest upload — see CLAUDE.md's "Browse
  // experience"), so the first entry is the correct hero pick as-is.
  const featured = albums[0];
  const shared = albums.filter((album) => album.type === "shared");

  // Grouped by the year of that same activity date, newest year first —
  // replaces a single unbounded "All albums" row with something that
  // still scales once an account has spanned a few years.
  const albumsByYear = new Map<string, typeof albums>();
  for (const album of albums) {
    const year = album.updatedAt.slice(0, 4);
    albumsByYear.set(year, [...(albumsByYear.get(year) ?? []), album]);
  }
  const yearRows = [...albumsByYear.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([year, yearAlbums]) => ({ label: year, albums: yearAlbums }));

  const rows = [
    { label: "Recently added", albums: albums.slice(0, 5) },
    ...(shared.length > 0
      ? [{ label: "Shared with family & friends", albums: shared }]
      : []),
    ...yearRows,
  ];

  return (
    <div className="flex-1">
      <Navbar />
      <BrowseHome featured={featured} rows={rows} albums={albums} />
    </div>
  );
}
