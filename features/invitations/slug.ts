import { createClient } from "@/lib/supabase/server";

export const INVITATION_SLUG_MAX_LENGTH = 80;
export const INVITATION_SLUG_SUFFIX_LENGTH = 8;
export const INVITATION_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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

    return slugifyInvitationText(base);
}

export function slugifyInvitationText(value: string) {
    return value
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "");
}

export function getInvitationSlugSuffix(invitationId: string, length = INVITATION_SLUG_SUFFIX_LENGTH) {
    return invitationId.replace(/-/g, "").toLowerCase().slice(0, length);
}

export function buildInvitationSlug(
    readableName: string,
    invitationId: string,
    maxLength = INVITATION_SLUG_MAX_LENGTH,
    suffixLength = INVITATION_SLUG_SUFFIX_LENGTH
) {
    const suffix = getInvitationSlugSuffix(invitationId, suffixLength);
    if (!suffix) {
        throw new Error("SLUG_GENERATION_FAILED");
    }

    const reservedLength = suffix.length + 1;
    const baseMaxLength = Math.max(1, maxLength - reservedLength);
    const base = slugifyInvitationText(readableName)
        .slice(0, baseMaxLength)
        .replace(/-+$/g, "");

    return `${base || "invitation"}-${suffix}`;
}

export function getInvitationReadableName(invitation: {
    primary_name?: string | null;
    secondary_name?: string | null;
    title?: string | null;
    category?: string | null;
}) {
    if (invitation.primary_name?.trim() && invitation.secondary_name?.trim()) {
        return `${invitation.primary_name} ${invitation.secondary_name}`;
    }
    return invitation.primary_name?.trim() || invitation.title?.trim() || invitation.category?.trim() || "invitation";
}

export function isValidInvitationSlug(slug: string) {
    return slug.length >= 3 && slug.length <= INVITATION_SLUG_MAX_LENGTH && INVITATION_SLUG_PATTERN.test(slug);
}

export async function isSlugAvailable(slug: string, excludeInvitationId?: string) {
    const cleanSlug = slug.toLowerCase().trim();
    if (!cleanSlug || !isValidInvitationSlug(cleanSlug)) {
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

export async function generateUniqueSlug(primaryName: string, secondaryName: string | undefined, category: string | undefined, invitationId: string) {
    const readableName = generateBaseSlug(primaryName, secondaryName, category) || "invitation";
    return buildInvitationSlug(readableName, invitationId);
}
