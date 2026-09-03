import { describe, expect, it } from "vitest";
import {
  MAX_PHOTO_BYTES,
  MAX_VIDEO_BYTES,
  MAX_VIDEO_DURATION_SECONDS,
  MAX_VIDEO_LONG_EDGE,
  MAX_VIDEO_SHORT_EDGE,
  extensionForMime,
  kindForMime,
  validateFile,
  validateVideoMetadata,
} from "@/lib/media/constraints";

describe("kindForMime", () => {
  it("classifies known photo and video mime types", () => {
    expect(kindForMime("image/jpeg")).toBe("photo");
    expect(kindForMime("video/mp4")).toBe("video");
  });

  it("rejects unknown mime types", () => {
    expect(kindForMime("application/pdf")).toBeNull();
    expect(kindForMime("")).toBeNull();
  });
});

describe("extensionForMime", () => {
  it("maps known mime types to their extension", () => {
    expect(extensionForMime("image/png")).toBe("png");
    expect(extensionForMime("video/quicktime")).toBe("mov");
  });

  it("falls back to .bin for unknown mime types", () => {
    expect(extensionForMime("application/pdf")).toBe("bin");
  });
});

describe("validateFile", () => {
  it("rejects an unsupported mime type", () => {
    const result = validateFile({ type: "application/pdf", size: 1000 });
    expect(result?.error).toMatch(/unsupported/i);
  });

  it("accepts a photo at exactly the size cap", () => {
    const result = validateFile({ type: "image/jpeg", size: MAX_PHOTO_BYTES });
    expect(result).toBeNull();
  });

  it("rejects a photo one byte over the size cap", () => {
    const result = validateFile({ type: "image/jpeg", size: MAX_PHOTO_BYTES + 1 });
    expect(result?.error).toMatch(/25 MB/);
  });

  it("accepts a video at exactly the size cap", () => {
    const result = validateFile({ type: "video/mp4", size: MAX_VIDEO_BYTES });
    expect(result).toBeNull();
  });

  it("rejects a video one byte over the size cap", () => {
    const result = validateFile({ type: "video/mp4", size: MAX_VIDEO_BYTES + 1 });
    expect(result?.error).toMatch(/45 MB/);
  });
});

describe("validateVideoMetadata", () => {
  it("accepts a video exactly at the duration and resolution caps", () => {
    const result = validateVideoMetadata(
      MAX_VIDEO_DURATION_SECONDS,
      MAX_VIDEO_LONG_EDGE,
      MAX_VIDEO_SHORT_EDGE,
    );
    expect(result).toBeNull();
  });

  it("rejects a video one second over the duration cap", () => {
    const result = validateVideoMetadata(MAX_VIDEO_DURATION_SECONDS + 1, 1920, 1080);
    expect(result?.error).toMatch(/5 minutes/);
  });

  it("rejects a video over the resolution cap regardless of orientation", () => {
    // Portrait: long edge (height) over the cap.
    const portrait = validateVideoMetadata(60, 1080, MAX_VIDEO_LONG_EDGE + 1);
    expect(portrait?.error).toMatch(/1080p/);

    // Landscape: short edge (height) over the cap.
    const landscape = validateVideoMetadata(60, MAX_VIDEO_LONG_EDGE, MAX_VIDEO_SHORT_EDGE + 1);
    expect(landscape?.error).toMatch(/1080p/);
  });
});
