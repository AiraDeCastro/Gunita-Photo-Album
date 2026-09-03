import { describe, expect, it } from "vitest";
import { FREE_TIER_BYTES, formatBytes, wouldExceedQuota } from "@/lib/storage/quota";

describe("wouldExceedQuota", () => {
  it("allows an upload that lands exactly on the limit", () => {
    expect(wouldExceedQuota(0, FREE_TIER_BYTES)).toBe(false);
    expect(wouldExceedQuota(FREE_TIER_BYTES - 1, 1)).toBe(false);
  });

  it("blocks an upload that would go one byte over the limit", () => {
    expect(wouldExceedQuota(FREE_TIER_BYTES, 1)).toBe(true);
    expect(wouldExceedQuota(FREE_TIER_BYTES - 1, 2)).toBe(true);
  });

  it("blocks uploads for an account already over the limit", () => {
    expect(wouldExceedQuota(FREE_TIER_BYTES + 1_000, 1)).toBe(true);
  });

  it("respects a custom limit, for callers that don't use the free tier default", () => {
    expect(wouldExceedQuota(50, 50, 100)).toBe(false);
    expect(wouldExceedQuota(51, 50, 100)).toBe(true);
  });
});

describe("formatBytes", () => {
  it("formats gigabyte-scale values with no decimal at 10+ GB", () => {
    expect(formatBytes(15_000_000_000)).toBe("15 GB");
  });

  it("formats gigabyte-scale values with one decimal under 10 GB", () => {
    expect(formatBytes(2_500_000_000)).toBe("2.5 GB");
  });

  it("formats megabyte-scale values with no decimal at 10+ MB", () => {
    expect(formatBytes(25_000_000)).toBe("25 MB");
  });

  it("formats megabyte-scale values with one decimal under 10 MB", () => {
    expect(formatBytes(5_000_000)).toBe("5.0 MB");
  });

  it("formats sub-megabyte values in KB, rounding up to at least 1", () => {
    expect(formatBytes(500)).toBe("1 KB");
    expect(formatBytes(2_500)).toBe("3 KB");
  });
});
