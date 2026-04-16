import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { uploadsDir } from "@/lib/storage/uploads";

/** Безопасное имя файла в каталоге uploads (без path traversal). */
function safeBasename(name: string): string | null {
  const base = path.basename(name);
  if (!base || base !== name || base.includes("..")) return null;
  if (!/^[a-zA-Z0-9._-]+$/.test(base)) return null;
  return base;
}

/**
 * Раздача файлов из public/uploads (в т.ч. созданных при генерации).
 * Прямой роут надёжнее, чем надеяться на static из public в production.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ filename: string }> }
) {
  const { filename: raw } = await ctx.params;
  const filename = safeBasename(raw);
  if (!filename) {
    return new NextResponse("Not found", { status: 404 });
  }

  const dir = uploadsDir();
  const full = path.join(dir, filename);
  const resolved = path.resolve(full);
  const baseResolved = path.resolve(dir);
  if (!resolved.startsWith(baseResolved + path.sep) && resolved !== baseResolved) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const buf = await readFile(resolved);
    const ext = path.extname(filename).toLowerCase();
    const mime =
      ext === ".png"
        ? "image/png"
        : ext === ".jpg" || ext === ".jpeg"
          ? "image/jpeg"
          : ext === ".webp"
            ? "image/webp"
            : ext === ".gif"
              ? "image/gif"
              : "application/octet-stream";

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
