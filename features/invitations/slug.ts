import { createClient } from "@/lib/supabase/server";

export function generateBaseSlug(primaryName: string, secondaryName?: string, category?: string) {
    let base = "";
    if (primaryName && secondaryName) {
        base = `${primaryName} & ${secondaryName}`;
    } else if (primaryName) {
        base = primaryName;
    }

    if (category && category !== "custom") {
        base = `${base} ${category}`;
    }

    return base
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-&]/g, "") // remove unsafe characters
        .replace(/[\s&]+/g, "-")       // spaces and & to hyphens
        .replace(/-+/g, "-")           // collapse consecutive hyphens
        .replace(/^-|-$/g, "");        // trim leading/trailing hyphens
}

export async function isSlugAvailable(slug: string, excludeInvitationId?: string) {
    const cleanSlug = slug.toLowerCase().trim();
    if (!cleanSlug || cleanSlug.length < 3 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cleanSlug)) {
        return false;
    }

    const supabase = await createClient();
    let query = supabase
        .from("invitations")
        .select("id", { count: "exact", head: true })
        .eq("slug", cleanSlug);

    if (excludeInvitationId) {
        query = query.neq("id", excludeInvitationId);
    }

    const { error, count } = await query;
    if (error) return false;
    return count === 0;
}

export async function generateUniqueSlug(primaryName: string, secondaryName?: string, category?: string) {
    const baseSlug = generateBaseSlug(primaryName, secondaryName, category) || "invite";

    let slug = baseSlug;
    const isAvailable = await isSlugAvailable(slug);

    if (isAvailable) {
        return slug;
    }

    // Try appending numbers 2 to 9
    for (let i = 2; i <= 9; i++) {
        const candidate = `${baseSlug}-${i}`;
        const isCandidateAvailable = await isSlugAvailable(candidate);
        if (isCandidateAvailable) {
            return candidate;
        }
    }

    // Try appending a short random suffix
    while (true) {
        const randomSuffix = Math.random().toString(36).substring(2, 6);
        const candidate = `${baseSlug}-${randomSuffix}`;
        const isCandidateAvailable = await isSlugAvailable(candidate);
        if (isCandidateAvailable) {
            return candidate;
        }
    }
}
