import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        pathname: "/t/p/**",
      },
    ],
    // URLs locales avec query string (cache-busting `?v=…` après upload) :
    // Next 16 les rejette par défaut, il faut les autoriser explicitement.
    localPatterns: [
      { pathname: "/api/profile-media/**" },
      { pathname: "/uploads/**" },
    ],
  },
};

export default nextConfig;
