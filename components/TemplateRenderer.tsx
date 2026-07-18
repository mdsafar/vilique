"use client";

import PastelFloralWedding from "@/components/templates/PastelFloralWedding";
import { InvitationData, RSVPStatus } from "@/types/invitation";
import { AnalyticsEventType } from "@/lib/analytics";

type TemplateRendererProps = {
    invitation: InvitationData;
    accepted?: boolean;
    rsvpStatus?: RSVPStatus | null;
    demoCountdownTargetDate?: Date;
    onAccept?: () => void;
    onDecline?: () => void;
    onChangeRsvp?: () => void;
    onEvent?: (type: AnalyticsEventType) => void;
    enableAudio?: boolean;
    rsvpProcessing?: boolean;
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
    rsvpStatus,
    demoCountdownTargetDate,
    onAccept,
    onDecline,
    onChangeRsvp,
    onEvent,
    enableAudio,
    rsvpProcessing,
}: TemplateRendererProps) {
    const props = { invitation, accepted, rsvpStatus, demoCountdownTargetDate, onAccept, onDecline, onChangeRsvp, onEvent, enableAudio, rsvpProcessing };

    switch (invitation.templateId) {
        case "pastel-floral-wedding":
        default:
            return <PastelFloralWedding {...props} />;
    }
}
