import { NextResponse } from "next/server";
import { createPublicClient, decodeEventLog, http } from "viem";
import { getSelectedChain, getSelectedRpcUrl, payPerViewAbi, payPerViewAddress, proofVerifierAbi, proofVerifierAddress } from "@/constants";
import { createSignedYoutubeUrl } from "@/lib/stream-signing";

export const runtime = "nodejs";

const rateLimit = new Map<string, number[]>();

function checkRateLimit(key: string) {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;
  const history = (rateLimit.get(key) || []).filter((ts) => ts >= oneHourAgo);

  if (history.length >= 10) return false;
  history.push(now);
  rateLimit.set(key, history);
  return true;
}

function getVideoUrlFromEnv(videoId: number): string | undefined {
  return process.env[`YOUTUBE_URL_VIDEO_${videoId}`];
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const videoIdRaw = searchParams.get("videoId");
  const viewer = searchParams.get("viewer") as `0x${string}` | null;

  if (!videoIdRaw || !viewer) {
    return NextResponse.json({ error: "Missing videoId or viewer" }, { status: 400 });
  }

  const videoId = Number(videoIdRaw);
  if (Number.isNaN(videoId)) {
    return NextResponse.json({ error: "Invalid videoId" }, { status: 400 });
  }

  if (!payPerViewAddress || !proofVerifierAddress) {
    return NextResponse.json({ error: "Contract addresses not configured" }, { status: 500 });
  }

  const key = `${viewer.toLowerCase()}:${videoId}`;
  if (!checkRateLimit(key)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const chain = getSelectedChain();
  const client = createPublicClient({ chain, transport: http(getSelectedRpcUrl()) });

  const hasActive = (await client.readContract({
    address: payPerViewAddress,
    abi: payPerViewAbi,
    functionName: "hasActiveAccess",
    args: [viewer, BigInt(videoId)],
  })) as boolean;

  if (!hasActive) {
    return NextResponse.json({ error: "No active Somnia access" }, { status: 403 });
  }

  const logs = await client.getLogs({
    address: proofVerifierAddress,
    fromBlock: 0n,
    toBlock: "latest",
  });

  const accessGrantedLog = logs
    .map((log) => {
      try {
        return decodeEventLog({ abi: proofVerifierAbi, data: log.data, topics: log.topics });
      } catch {
        return null;
      }
    })
    .find((decoded) => {
      if (!decoded || decoded.eventName !== "AccessGranted") return false;
      const args = decoded.args as { viewer?: string; videoId?: bigint };
      return args.viewer?.toLowerCase() === viewer.toLowerCase() && Number(args.videoId) === videoId;
    });

  if (!accessGrantedLog) {
    return NextResponse.json({ error: "Access proof not yet granted" }, { status: 403 });
  }

  const baseUrl = getVideoUrlFromEnv(videoId);
  if (!baseUrl) {
    return NextResponse.json({ error: `Missing YOUTUBE_URL_VIDEO_${videoId}` }, { status: 500 });
  }

  const { signedUrl, expiresAt } = createSignedYoutubeUrl(baseUrl, 15 * 60);

  return NextResponse.json({
    videoId,
    signedUrl,
    expiresAt,
  });
}
