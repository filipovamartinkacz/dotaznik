import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Soubory ke stažení (např. PDF dárek z e-mailu) — nemají se
        // indexovat ani objevovat ve vyhledávačích.
        source: "/soubory/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
