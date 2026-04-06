"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const videos = [
	{
		id: 1,
		title: "Private Creator Session 01",
		summary: "30-day rental access gated by Somnia STT payment + Aleo proof.",
	},
	{
		id: 2,
		title: "Private Creator Session 02",
		summary: "Non-transferable rental access with Verulink proof relay.",
	},
	{
		id: 3,
		title: "Private Creator Session 03",
		summary: "Client-side decryption in Leo wallet before stream unlock.",
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
					Rent private/unlisted YouTube videos for 30 days using STT on Somnia,
					then prove Aleo access via Verulink. URLs are encrypted and decrypted
					client-side only.
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
