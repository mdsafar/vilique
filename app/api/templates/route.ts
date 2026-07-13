import { NextResponse } from "next/server";
import { getActiveTemplates } from "@/features/invitations/data";

export async function GET() {
    try {
        const templates = await getActiveTemplates();
        return NextResponse.json(templates);
    } catch (error) {
        console.error("Failed to fetch active templates:", error);
        return NextResponse.json({ error: "Failed to fetch active templates" }, { status: 500 });
    }
}
