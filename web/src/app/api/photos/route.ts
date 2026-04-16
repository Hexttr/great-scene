import { NextResponse } from "next/server";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { saveUpload } from "@/lib/storage/uploads";

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "нужен файл" }, { status: 400 });
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "image/jpeg";
  const safe = `${Date.now()}_${file.name || "upload"}`.replace(/[^a-zA-Z0-9._-]/g, "_");
  const webPath = await saveUpload(safe, buf);

  let width: number | undefined;
  let height: number | undefined;
  try {
    const meta = await sharp(buf).metadata();
    width = meta.width;
    height = meta.height;
  } catch {
    /* ignore */
  }

  const photo = await prisma.userPhoto.create({
    data: {
      filename: safe,
      mimeType,
      width: width ?? null,
      height: height ?? null,
      status: "PENDING",
    },
  });

  return NextResponse.json({
    id: photo.id,
    url: webPath,
    mimeType,
    width,
    height,
  });
}

export async function GET() {
  const list = await prisma.userPhoto.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json(
    list.map((p) => ({
      ...p,
      url: `/uploads/${p.filename}`,
    }))
  );
}
