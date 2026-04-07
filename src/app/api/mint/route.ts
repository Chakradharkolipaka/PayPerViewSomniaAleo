import { POST as uploadPOST } from "../aleo-storage/upload/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return uploadPOST(request);
}
