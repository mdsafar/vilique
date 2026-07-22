import type { EditorTab } from "@/features/builder/types";
import type {
    BuilderValidationFieldKey,
} from "@/features/invitations/validation";

export const requiredFieldTabs: Record<
    BuilderValidationFieldKey,
    EditorTab
> = {
    title: "content",
    primaryName: "content",
    secondaryName: "content",
    message: "content",
    eventDate: "event",
    eventTime: "event",
    venueName: "event",
    venueAddress: "event",
    phone: "contact",
    secondaryPhone: "contact",
    mapLink: "contact",
    musicUrl: "sound",
};

export function formatSaveError(
    error: unknown,
): string {
    if (!error) {
        return "Save failed";
    }

    if (typeof error === "string") {
        return error;
    }

    if (typeof error === "object") {
        const result = error as {
            fieldErrors?: Record<
                string,
                unknown
            >;
            formErrors?: unknown;
            message?: unknown;
        };

        if (
            result.fieldErrors &&
            typeof result.fieldErrors ===
            "object"
        ) {
            const keys = Object.keys(
                result.fieldErrors,
            );

            if (keys.length > 0) {
                const firstField = keys[0];

                const fieldMessages =
                    result.fieldErrors[
                    firstField
                    ];

                if (
                    Array.isArray(
                        fieldMessages,
                    ) &&
                    fieldMessages.length > 0
                ) {
                    return `${firstField}: ${fieldMessages[0]}`;
                }
            }
        }

        if (
            Array.isArray(
                result.formErrors,
            ) &&
            result.formErrors.length > 0
        ) {
            return String(
                result.formErrors[0],
            );
        }

        if (
            typeof result.message ===
            "string"
        ) {
            return result.message;
        }
    }

    return "Save failed";
}