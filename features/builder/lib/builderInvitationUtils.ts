import {
    normalizeInvitationDate,
} from "@/features/builder/lib/builderDateUtils";
import {
    createDefaultInvitation,
} from "@/lib/defaultInvitation";
import type {
    InvitationData,
} from "@/types/invitation";

export function createFreshBuilderInvitation(
    templateKey: string,
): InvitationData {
    return normalizeInvitationDate({
        ...createDefaultInvitation(),
        templateId: templateKey,
        updatedAt: new Date().toISOString(),
    });
}