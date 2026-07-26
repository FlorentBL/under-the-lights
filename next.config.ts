import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "elrincondeldt.com",
        pathname: "/sv/photos/teams/**",
      },
    ],
  },
};

export default nextConfig;
