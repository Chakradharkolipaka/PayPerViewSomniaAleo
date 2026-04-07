import { promises as fs } from "fs";
import path from "path";

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

async function ensureCatalogFile() {
  await fs.mkdir(STORAGE_DIR, { recursive: true });

  try {
    await fs.access(CATALOG_FILE);
  } catch {
    await fs.writeFile(CATALOG_FILE, "[]", "utf8");
  }
}

export async function readVideoCatalog(): Promise<VideoRecord[]> {
  await ensureCatalogFile();
  const raw = await fs.readFile(CATALOG_FILE, "utf8");

  try {
    const parsed = JSON.parse(raw) as VideoRecord[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

async function writeVideoCatalog(items: VideoRecord[]) {
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