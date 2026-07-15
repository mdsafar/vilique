import { NextResponse } from "next/server";
import { buildInvitationSlug, isSlugAvailable, slugifyInvitationText } from "@/features/invitations/slug";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug") || "";
    const invitationId = searchParams.get("invitationId") || searchParams.get("excludeId") || "";

    if (!slug) {
        return NextResponse.json({ status: "invalid", message: "Slug is required" });
    }

    const readableSlug = slugifyInvitationText(slug);
    if (readableSlug.length < 3) {
        return NextResponse.json({ status: "invalid", message: "Slug must be at least 3 characters" });
    }

    if (!invitationId) {
        return NextResponse.json({ status: "invalid", message: "Invitation ID is required" });
    }

    const finalSlug = buildInvitationSlug(readableSlug, invitationId);
    const isAvailable = await isSlugAvailable(finalSlug, invitationId);

    if (!isAvailable) {
        return NextResponse.json({
            available: false,
            finalSlug,
            status: "taken",
            message: "This link is already in use. Try another name.",
        });
    }

    return NextResponse.json({
        available: true,
        finalSlug,
        status: "available",
        message: "Available!",
    });
}
