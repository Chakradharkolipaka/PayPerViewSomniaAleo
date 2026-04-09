"use client";

import Link from "next/link";
import { PlayCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export type NFTCardVideo = {
  id: number;
  title: string;
  description: string;
  creator: string;
  priceSTT: string;
};

interface NFTCardProps {
  video: NFTCardVideo;
}

export default function NFTCard({ video }: NFTCardProps) {
  return (
    <Card className="group h-full border-slate-200/80 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_60px_-26px_rgba(59,130,246,0.55)]">
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/70 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white">
              PPV
            </span>
            Access NFT
          </div>
          <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
            #{video.id}
          </span>
        </div>
        <div>
          <CardTitle className="line-clamp-1 text-xl tracking-tight">{video.title}</CardTitle>
          <CardDescription>Creator: {video.creator.slice(0, 8)}...</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="line-clamp-2 text-sm text-muted-foreground">{video.description}</p>
        <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs">
          <span className="font-medium text-slate-600">Price</span>
          <span className="font-semibold text-slate-900">{video.priceSTT} STT</span>
        </div>
        <Link href={`/videos/${video.id}`}>
          <Button className="w-full gap-2 transition-transform duration-300 group-hover:scale-[1.01]">
            <PlayCircle className="h-4 w-4" />
            Watch
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
