import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const checks = {
    somniaRpc: Boolean(process.env.SOMNIA_RPC_URL || process.env.NEXT_PUBLIC_SOMNIA_RPC_URL),
    accessNftAddress: Boolean(process.env.ACCESS_NFT_ADDRESS || process.env.NEXT_PUBLIC_ACCESS_NFT_ADDRESS),
    backendKey: Boolean(process.env.BACKEND_PRIVATE_KEY),
    ppvMasterKey: Boolean(process.env.PPV_MASTER_KEY),
  };

  return NextResponse.json({
    status: "ok",
    checks,
  });
}