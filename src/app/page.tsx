import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Landing from "@/components/Landing";
import AlbumRow from "@/components/AlbumRow";
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

  // Ordering by "most recently updated" is a placeholder for the hero pick
  // — proper "recently active" logic (last upload, not last edit) is
  // Milestone 7 (TASKS.md), once media actually exists to be active about.
  const featured = albums[0];
  const shared = albums.filter((album) => album.type === "shared");

  const rows = [
    { label: "Recently added", albums: albums.slice(0, 5) },
    ...(shared.length > 0
      ? [{ label: "Shared with family & friends", albums: shared }]
      : []),
    { label: "All albums", albums },
  ];

  return (
    <div className="flex-1">
      <Navbar />
      <Hero album={featured} />
      <div className="flex justify-end px-6 md:px-10 pt-6">
        <CreateAlbumForm />
      </div>
      <div className="pt-4 pb-16">
        {rows.map((row) => (
          <AlbumRow key={row.label} label={row.label} albums={row.albums} />
        ))}
      </div>
    </div>
  );
}
