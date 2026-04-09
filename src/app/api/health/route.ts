import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const environment = process.env.NODE_ENV || "development";
  const checks = {
    somniaRpc: Boolean(process.env.SOMNIA_RPC_URL || process.env.NEXT_PUBLIC_SOMNIA_RPC_URL),
    accessNftAddress: Boolean(process.env.ACCESS_NFT_ADDRESS || process.env.NEXT_PUBLIC_ACCESS_NFT_ADDRESS),
    backendKey: Boolean(process.env.BACKEND_PRIVATE_KEY),
    ppvMasterKey: Boolean(process.env.PPV_MASTER_KEY),
    blobStorage: Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_BLOB_READ_WRITE_TOKEN),
  };

  const mintReadiness = {
    environment,
    ready: checks.ppvMasterKey && (environment !== "production" || checks.blobStorage),
    reasons: [
      ...(checks.ppvMasterKey ? [] : ["PPV_MASTER_KEY is missing"]),
      ...(environment === "production" && !checks.blobStorage
        ? ["BLOB_READ_WRITE_TOKEN (or VERCEL_BLOB_READ_WRITE_TOKEN) is missing"]
        : []),
    ],
  };

  return NextResponse.json({
    status: mintReadiness.ready ? "ok" : "degraded",
    checks,
    mintReadiness,
  });
}