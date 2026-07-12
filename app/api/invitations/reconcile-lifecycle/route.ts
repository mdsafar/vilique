import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isEventCompleted } from "@/lib/lifecycle";

export async function POST(request: Request) {
    // 1. Secure scheduled cron route in production
    const authHeader = request.headers.get("Authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        if (process.env.NODE_ENV === "production") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
    }

    const supabase = createAdminClient();

    // 2. Fetch all currently active published invitations
    const { data: invitations, error } = await supabase
        .from("invitations")
        .select("id, event_date, event_time, event_timezone, lifecycle_status")
        .eq("lifecycle_status", "published");

    if (error) {
        console.error("Error fetching invitations for reconciliation:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 3. Filter completed events based on timezone and end time
    const completedIds: string[] = [];
    for (const invite of invitations || []) {
        const completed = isEventCompleted({
            eventDate: invite.event_date,
            eventTime: invite.event_time,
            eventTimezone: invite.event_timezone,
        });
        if (completed) {
            completedIds.push(invite.id);
        }
    }

    // 4. Update matching records to completed state
    if (completedIds.length > 0) {
        const { error: updateError } = await supabase
            .from("invitations")
            .update({
                lifecycle_status: "completed",
                completed_at: new Date().toISOString()
            })
            .in("id", completedIds);

        if (updateError) {
            console.error("Failed to update status for reconciled items:", updateError);
            return NextResponse.json({ error: updateError.message }, { status: 500 });
        }
    }

    return NextResponse.json({
        reconciled: invitations?.length || 0,
        completedCount: completedIds.length,
        completedIds
    }, { status: 200 });
}
