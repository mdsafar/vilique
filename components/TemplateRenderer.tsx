"use client";

import PastelFloralWedding from "@/components/templates/PastelFloralWedding";
import { InvitationData, RSVPStatus } from "@/types/invitation";
import { AnalyticsEventType } from "@/lib/analytics";

type TemplateRendererProps = {
    invitation: InvitationData;
    accepted?: boolean;
    onAccept?: () => void;
    onDecline?: () => void;
    onEvent?: (type: AnalyticsEventType) => void;
    enableAudio?: boolean;
};

/**
 * Resolves and renders the correct invitation template component
 * based on `invitation.templateId`, which is sourced from the backend
 * `invitation_templates.template_key` column.
 *
 * Add new template cases here as new templates are built.
 */
export default function TemplateRenderer({
    invitation,
    accepted,
    onAccept,
    onDecline,
    onEvent,
    enableAudio,
}: TemplateRendererProps) {
    const props = { invitation, accepted, onAccept, onDecline, onEvent, enableAudio };

    switch (invitation.templateId) {
        case "pastel-floral-wedding":
        default:
            return <PastelFloralWedding {...props} />;
    }
}
