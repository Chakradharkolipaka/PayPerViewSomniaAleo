export async function relayProofToVerulink(input: {
  proof: `0x${string}`;
  videoId: number;
  viewer: `0x${string}`;
}) {
  const relayUrl = process.env.NEXT_PUBLIC_VERULINK_RELAY_URL;
  if (!relayUrl) {
    throw new Error("NEXT_PUBLIC_VERULINK_RELAY_URL is not configured.");
  }

  const response = await fetch(relayUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sourceChain: "aleo-testnet",
      targetChain: "somnia-testnet",
      messageType: "zk-proof-relay",
      payload: {
        aleoProof: input.proof,
        videoId: input.videoId,
        viewer: input.viewer,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Verulink relay failed: ${response.status} ${text}`);
  }

  return response.json();
}
