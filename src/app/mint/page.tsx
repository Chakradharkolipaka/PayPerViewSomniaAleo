import Link from "next/link";

export default function MintPageDeprecated() {
  return (
    <main className="container mx-auto px-4 py-10">
      <div className="rounded-xl border p-6 space-y-2">
        <h1 className="text-2xl font-semibold">Deprecated route</h1>
        <p className="text-sm text-muted-foreground">
          NFT minting/IPFS flow was removed. Use the Somnia pay-per-view watch flow instead.
        </p>
        <Link href="/videos/1" className="text-sm underline">
          Open `/videos/1`
        </Link>
      </div>
    </main>
  );
}
