import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "data", "uploads");

// Minimal 1x1 transparent PNG used when a photo file is missing
const PLACEHOLDER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  // Sanitize: no paths, plain single filename only
  const safe = path.basename(file);
  if (!safe || safe.startsWith(".") || !/\.(jpg|png|webp)$/i.test(safe)) {
    return new NextResponse(PLACEHOLDER, { status: 404, headers: pngHeaders() });
  }
  try {
    const buf = await fs.readFile(path.join(UPLOAD_DIR, safe));
    const type = TYPES[path.extname(safe).toLowerCase()] ?? "application/octet-stream";
    return new NextResponse(buf, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse(PLACEHOLDER, { status: 404, headers: pngHeaders() });
  }
}

function pngHeaders() {
  return { "Content-Type": "image/png", "Cache-Control": "no-store" };
}
