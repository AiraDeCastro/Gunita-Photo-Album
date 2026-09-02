import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Next's image optimizer refuses private-IP hosts by default (SSRF
    // protection) — 127.0.0.1 is exactly what local Supabase Storage is.
    // Fine here since it's only ever this machine; a deployed Supabase
    // project has a real hostname and won't need this.
    dangerouslyAllowLocalIP: true,
    remotePatterns: [
      {
        // Local Supabase Storage (supabase start) — signed media URLs.
        // Add the deployed Supabase project's storage host here too once
        // this ships somewhere other than this machine.
        protocol: "http",
        hostname: "127.0.0.1",
        port: "54321",
        pathname: "/storage/v1/**",
      },
    ],
  },
};

export default nextConfig;
