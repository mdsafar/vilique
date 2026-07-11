import { NextResponse } from "next/server";
import { isSlugAvailable } from "@/features/invitations/slug";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug") || "";
    const excludeId = searchParams.get("excludeId") || "";

    if (!slug) {
        return NextResponse.json({ status: "invalid", message: "Slug is required" });
    }

    const cleanSlug = slug.toLowerCase().trim();
    if (cleanSlug.length < 3) {
        return NextResponse.json({ status: "invalid", message: "Slug must be at least 3 characters" });
    }

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cleanSlug)) {
        return NextResponse.json({ status: "invalid", message: "Use lowercase letters, numbers, and hyphens only" });
    }

    const isAvailable = await isSlugAvailable(cleanSlug, excludeId);

    if (!isAvailable) {
        return NextResponse.json({ status: "taken", message: "Already taken" });
    }

    return NextResponse.json({ status: "available", message: "Available!" });
}
