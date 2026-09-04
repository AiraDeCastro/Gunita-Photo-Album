import Link from "next/link";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import AlbumSettingsForm from "@/components/albums/AlbumSettingsForm";
import DeleteAlbumButton from "@/components/albums/DeleteAlbumButton";
import ManageMembers from "@/components/albums/ManageMembers";
import MediaUploader from "@/components/albums/MediaUploader";
import { getAlbumDetail } from "@/lib/albums/queries";
import { CAN_EDIT } from "@/lib/albums/types";
import { getAlbumMedia } from "@/lib/media/queries";
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
  const media = await getAlbumMedia(album.id);

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
          {album.role === "owner" && (
            <DeleteAlbumButton albumId={album.id} albumTitle={album.title} />
          )}
        </div>

        <ManageMembers
          albumId={album.id}
          members={album.members}
          myRole={album.role}
          myUserId={user!.id}
        />

        <MediaUploader
          albumId={album.id}
          canUpload={canEdit}
          media={media}
          coverMediaId={album.coverMediaId}
        />

        <p className="mt-8 text-sm text-text-faint">
          <Link href="/" className="text-accent hover:underline">
            Back to browse
          </Link>
        </p>
      </div>
    </div>
  );
}
