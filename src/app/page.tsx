"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const videos = [
	{
		id: 1,
		title: "Private Creator Session 01",
		summary: "Single-view access gated by fixed 0.005 STT payment + Aleo proof.",
	},
	{
		id: 2,
		title: "Private Creator Session 02",
		summary: "Single-use NFT is consumed on first verified viewing session.",
	},
	{
		id: 3,
		title: "Private Creator Session 03",
		summary: "Encrypted static assets unlocked with Aleo-derived view key.",
	},
];

export default function Home() {
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

			<section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{videos.map((video) => (
					<Card key={video.id} className="h-full">
						<CardHeader>
							<CardTitle>{video.title}</CardTitle>
							<CardDescription>Video ID: {video.id}</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<p className="text-sm text-muted-foreground">
								{video.summary}
							</p>
							<Link href={`/videos/${video.id}`}>
								<Button className="w-full">Open Watch Page</Button>
							</Link>
						</CardContent>
					</Card>
				))}
			</section>
		</main>
	);
}
