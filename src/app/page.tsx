"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import NFTCard, { NFTCardVideo } from "@/components/NFTCard";

export default function Home() {
	const [videos, setVideos] = useState<NFTCardVideo[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => {
		async function loadVideos() {
			try {
				const res = await fetch("/api/videos", { cache: "no-store" });
				if (!res.ok) throw new Error(`Failed to load videos (${res.status})`);
				const payload = (await res.json()) as { videos: NFTCardVideo[] };
				setVideos(payload.videos || []);
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to load videos");
			} finally {
				setLoading(false);
			}
		}

		loadVideos();
	}, []);

	return (
		<main className="container mx-auto px-4 py-10 space-y-8">
			<section className="space-y-3">
				<h1 className="text-4xl md:text-5xl font-bold tracking-tight">
					Somnia Private Pay-Per-View
				</h1>
				<p className="text-muted-foreground max-w-3xl">
					Pay 0.005 STT once to mint a one-time access NFT, verify privacy with
					Aleo, and unlock encrypted static content with per-view key handoff.
				</p>
			</section>

			<section>
				{loading && <p className="text-muted-foreground">Loading minted videos...</p>}
				{error && <p className="text-red-500">{error}</p>}
				{!loading && !error && videos.length === 0 && (
					<Card>
						<CardContent className="pt-6 space-y-3">
							<p className="text-muted-foreground">No videos minted yet. Create your first one.</p>
							<Link href="/mint">
								<Button>Go to Mint</Button>
							</Link>
						</CardContent>
					</Card>
				)}

				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{videos.map((video) => (
						<NFTCard key={video.id} video={video} />
					))}
				</div>
			</section>
		</main>
	);
}
