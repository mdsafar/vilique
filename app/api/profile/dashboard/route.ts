import { NextResponse } from "next/server";
import { getProfilePageData } from "@/lib/profilePageData";
import { createClient } from "@/lib/supabase/server";
import { reportError } from "@/lib/observability";

export async function GET() {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const data = await getProfilePageData();
        return NextResponse.json(data);
    } catch (error) {
        console.error("Failed to fetch profile dashboard data:", error);
        reportError(error, "profile.dashboard_fetch_failed");
        return NextResponse.json({ error: "Failed to fetch dashboard data" }, { status: 500 });
    }
}
