import { POST as verifyPOST } from "../verify-and-serve/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return verifyPOST(request);
}
