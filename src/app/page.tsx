import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import AlbumRow from "@/components/AlbumRow";
import { featured, rows } from "@/lib/mock-data";

export default function BrowsePage() {
  return (
    <div className="flex-1">
      <Navbar />
      <Hero album={featured} />
      <div className="pt-8 pb-16">
        {rows.map((row) => (
          <AlbumRow key={row.label} label={row.label} albums={row.albums} />
        ))}
      </div>
    </div>
  );
}
