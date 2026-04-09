import { promises as fs } from "fs";
import path from "path";
import { list, put } from "@vercel/blob";

export type VideoRecord = {
  id: number;
  title: string;
  description: string;
  creator: string;
  priceSTT: string;
  createdAt: string;
  encryptedAssetUrl: string;
};

const STORAGE_DIR = path.join(process.cwd(), "storage");
const CATALOG_FILE = path.join(STORAGE_DIR, "videos.json");
const BLOB_CATALOG_PATH = "ppv/catalog/videos.json";

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function getBlobToken() {
  return process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_BLOB_READ_WRITE_TOKEN;
}

function canUseBlobStorage() {
  return Boolean(getBlobToken());
}

function isReadonlyFsError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const code = (error as NodeJS.ErrnoException).code;
  return code === "EROFS" || code === "EPERM" || code === "EACCES";
}

async function ensureCatalogFile() {
  if (canUseBlobStorage() || isProduction()) return;

  await fs.mkdir(STORAGE_DIR, { recursive: true });

  try {
    await fs.access(CATALOG_FILE);
  } catch {
    await fs.writeFile(CATALOG_FILE, "[]", "utf8");
  }
}

async function writeVideoCatalog(items: VideoRecord[]) {
  if (canUseBlobStorage()) {
    const token = getBlobToken();
    await put(BLOB_CATALOG_PATH, JSON.stringify(items, null, 2), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      token,
    });
    return;
  }

  if (isProduction()) {
    throw new Error("Catalog storage is not configured for production.");
  }

  await ensureCatalogFile();
  await fs.writeFile(CATALOG_FILE, JSON.stringify(items, null, 2), "utf8");
}

export async function listVideos(): Promise<VideoRecord[]> {
  const items = await readVideoCatalog();
  return [...items].sort((a, b) => Number(new Date(b.createdAt)) - Number(new Date(a.createdAt)));
}

export async function getVideoById(videoId: number): Promise<VideoRecord | undefined> {
  const items = await readVideoCatalog();
  return items.find((item) => item.id === videoId);
}

export async function createVideoRecord(input: {
  title: string;
  description: string;
  creator: string;
  encryptedAssetUrl: string;
}): Promise<VideoRecord> {
  const items = await readVideoCatalog();
  const nextId = items.length > 0 ? Math.max(...items.map((item) => item.id)) + 1 : 1;

  const video: VideoRecord = {
    id: nextId,
    title: input.title.trim(),
    description: input.description.trim(),
    creator: input.creator.trim(),
    priceSTT: "0.005",
    createdAt: new Date().toISOString(),
    encryptedAssetUrl: input.encryptedAssetUrl,
  };

  items.push(video);
  await writeVideoCatalog(items);

  return video;
}

export async function setVideoEncryptedAsset(videoId: number, encryptedAssetUrl: string) {
  const items = await readVideoCatalog();
  const updated = items.map((item) =>
    item.id === videoId ? { ...item, encryptedAssetUrl } : item
  );
  await writeVideoCatalog(updated);
}

async function readCatalogFromBlob(): Promise<VideoRecord[]> {
  const token = getBlobToken();
  if (!token) return [];

  const result = await list({ prefix: BLOB_CATALOG_PATH, limit: 1, token });
  const blob = result.blobs.find((entry) => entry.pathname === BLOB_CATALOG_PATH) ?? result.blobs[0];

  if (!blob) return [];

  const response = await fetch(blob.url, { cache: "no-store" });
  if (!response.ok) return [];

  const parsed = (await response.json()) as VideoRecord[];
  return Array.isArray(parsed) ? parsed : [];
}

export async function readVideoCatalog(): Promise<VideoRecord[]> {
  if (canUseBlobStorage()) {
    try {
      return await readCatalogFromBlob();
    } catch {
      return [];
    }
  }

  if (isProduction()) {
    return [];
  }

  try {
    await ensureCatalogFile();
    const raw = await fs.readFile(CATALOG_FILE, "utf8");

    try {
      const parsed = JSON.parse(raw) as VideoRecord[];
      if (!Array.isArray(parsed)) return [];
      return parsed;
    } catch {
      return [];
    }
  } catch (error) {
    if (isReadonlyFsError(error)) {
      return [];
    }
    throw error;
  }
}