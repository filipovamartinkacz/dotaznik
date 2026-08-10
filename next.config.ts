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
      {
        // PDF dárek — URL má náhodný název (viz email.ts), ale uložený
        // soubor má mít hezký, srozumitelný název.
        source: "/soubory/50-cest-k-sobe-868e1be595.pdf",
        headers: [
          {
            key: "Content-Disposition",
            value:
              "attachment; filename=\"JsemBlazena.cz - e-book - 50 cest k sobe.pdf\"; filename*=UTF-8''JsemBla%C5%BEen%C3%A1.cz%20-%20e-book%20-%2050%20cest%20k%20sob%C4%9B.pdf",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
