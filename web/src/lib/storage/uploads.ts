import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export function uploadsDir(): string {
  return path.join(process.cwd(), "public", "uploads");
}

export async function saveUpload(filename: string, data: Buffer): Promise<string> {
  const dir = uploadsDir();
  await mkdir(dir, { recursive: true });
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const full = path.join(dir, safe);
  await writeFile(full, data);
  return `/uploads/${safe}`;
}
