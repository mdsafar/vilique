import { createPublicServerClient } from "@/lib/supabase/public-server";

export async function getTemplateUsageSummaryMap(templateKeys: string[]) {
    if (!templateKeys.length) return new Map<string, number>();

    const supabase = createPublicServerClient();
    const { data, error } = await supabase.rpc("get_template_usage_summaries", {
        p_template_keys: templateKeys,
    });

    if (error || !data) {
        return new Map<string, number>();
    }

    return new Map(data.map((row) => [
        row.template_key,
        Number(row.usage_count || 0),
    ]));
}
