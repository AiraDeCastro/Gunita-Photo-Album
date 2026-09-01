import Link from "next/link";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import AlbumSettingsForm from "@/components/albums/AlbumSettingsForm";
import DeleteAlbumButton from "@/components/albums/DeleteAlbumButton";
import ManageMembers from "@/components/albums/ManageMembers";
import { getAlbumDetail } from "@/lib/albums/queries";
import { CAN_EDIT } from "@/lib/albums/types";
import { createClient } from "@/lib/supabase/server";

export default async function AlbumPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const album = await getAlbumDetail(id);
  if (!album) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const canEdit = CAN_EDIT.includes(album.role);

  return (
    <div className="flex-1">
      <Navbar />
      <div className="px-6 md:px-10 pb-16">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-wide text-text-muted mb-1">
              {album.type === "shared" ? "Shared album" : "Private album"}
            </p>
            <AlbumSettingsForm
              albumId={album.id}
              title={album.title}
              description={album.description}
              canEdit={canEdit}
            />
            <p className="text-sm text-text-muted mt-1">
              {album.itemCount} items · updated {album.updatedAt}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && (
              <button className="rounded-md border border-border px-4 py-2 text-sm text-text hover:bg-surface-sunken transition-colors">
                Upload
              </button>
            )}
            {album.role === "owner" && (
              <DeleteAlbumButton albumId={album.id} albumTitle={album.title} />
            )}
          </div>
        </div>

        <ManageMembers
          albumId={album.id}
          members={album.members}
          myRole={album.role}
          myUserId={user!.id}
        />

        {album.itemCount === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border py-20 text-center">
            <p className="text-sm text-text-muted">Nothing here yet.</p>
            {canEdit && (
              <p className="text-xs text-text-faint">
                Upload isn&apos;t wired up yet — coming in Milestone 4.
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {/* Populated once Milestone 4 (upload) lands. */}
          </div>
        )}

        <p className="mt-8 text-sm text-text-faint">
          <Link href="/" className="text-accent hover:underline">
            Back to browse
          </Link>
        </p>
      </div>
    </div>
  );
}
