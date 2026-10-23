export const runtime = "nodejs";

import fs from "node:fs";
import { jalurGambar } from "@/lib/karya";

export async function GET(req: Request) {
  const rel = new URL(req.url).searchParams.get("p") ?? "";
  const jalur = jalurGambar(rel);
  if (!jalur) return new Response("tidak ada", { status: 404 });
  return new Response(fs.readFileSync(jalur), {
    headers: {
      "content-type": jalur.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg",
      // Slide yang sudah dibuat tidak berubah; folder baru = jalur baru.
      "cache-control": "private, max-age=3600",
    },
  });
}
