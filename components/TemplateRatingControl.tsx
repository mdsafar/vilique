"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { useSWRConfig } from "swr";
import { Loader2, Star } from "lucide-react";
import { useToast } from "@/components/Toast";

type TemplateRatingState = {
    average: number | null;
    count: number;
    userRating: number | null;
    eligibleToRate: boolean;
};

type Props = {
    templateId: string;
    label?: string;
    compact?: boolean;
    disabledReason?: string;
};

async function fetchTemplateRating(endpoint: string): Promise<TemplateRatingState> {
    const response = await fetch(endpoint);
    if (!response.ok) {
        throw new Error("Unable to load template rating.");
    }
    return response.json();
}

export default function TemplateRatingControl({
    templateId,
    label = "Rate this template",
    compact = false,
    disabledReason,
}: Props) {
    const endpoint = `/api/templates/${encodeURIComponent(templateId)}/rating`;
    const { data, mutate } = useSWR<TemplateRatingState>(disabledReason ? null : endpoint, fetchTemplateRating, { suspense: false });
    const [hoverRating, setHoverRating] = useState<number | null>(null);
    const [savingRating, setSavingRating] = useState<number | null>(null);
    const [savedMessage, setSavedMessage] = useState("");
    const { showToast } = useToast();
    const { mutate: mutateGlobal } = useSWRConfig();

    const currentRating = data?.userRating ?? 0;
    const previewRating = hoverRating ?? currentRating;
    const shouldShowRating = data?.eligibleToRate ?? true;
    const accessibleLabel = useMemo(() => {
        if (!currentRating) return "No template rating selected";
        return `Current template rating is ${currentRating} out of 5 stars`;
    }, [currentRating]);

    if (!shouldShowRating) {
        return null;
    }

    async function handleRate(nextRating: number) {
        if (disabledReason) return;
        if (savingRating) return;

        const previous = data;
        setSavingRating(nextRating);
        setSavedMessage("");

        await mutate({
            ...(data || { average: null, count: 0, eligibleToRate: true }),
            userRating: nextRating,
        }, { revalidate: false });

        try {
            const response = await fetch(endpoint, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ rating: nextRating }),
            });
            const result = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(result.error || "Unable to save rating.");
            }

            await mutate(result, { revalidate: false });
            mutateGlobal(
                (key) => typeof key === "string" && key.includes("/api/templates"),
                undefined,
                { revalidate: true }
            );
            mutateGlobal(
                (key) => typeof key === "string" && key.includes("/api/profile/template-ratings"),
                undefined,
                { revalidate: true }
            );
            setSavedMessage("Rating saved");
            window.setTimeout(() => setSavedMessage(""), 1800);
        } catch (error) {
            await mutate(previous, { revalidate: false });
            showToast(error instanceof Error ? error.message : "Unable to save rating.", "error");
        } finally {
            setSavingRating(null);
        }
    }

    return (
        <section className={`templateRatingControl ${compact ? "templateRatingControl--compact" : ""}`} aria-label={label}>
            <div className="templateRatingControlText">
                <span>{label.endsWith(":") ? label : `${label}:`}</span>
                <p aria-live="polite">{disabledReason || savedMessage}</p>
            </div>
            <div className="templateRatingStars" role="radiogroup" aria-label={accessibleLabel}>
                {Array.from({ length: 5 }, (_, index) => {
                    const rating = index + 1;
                    const isActive = rating <= previewRating;
                    const isSaving = savingRating === rating;

                    return (
                        <button
                            type="button"
                            key={rating}
                            className={isActive ? "active" : ""}
                            onClick={() => handleRate(rating)}
                            onMouseEnter={() => setHoverRating(rating)}
                            onMouseLeave={() => setHoverRating(null)}
                            onFocus={() => setHoverRating(rating)}
                            onBlur={() => setHoverRating(null)}
                            role="radio"
                            aria-checked={currentRating === rating}
                            aria-label={disabledReason ? `${disabledReason}. Rating ${rating} out of 5 stars unavailable` : `Rate ${rating} out of 5 stars`}
                            disabled={Boolean(savingRating || disabledReason)}
                        >
                            {isSaving ? (
                                <Loader2 size={16} className="spinner" aria-hidden="true" />
                            ) : (
                                <Star size={17} fill={isActive ? "currentColor" : "none"} aria-hidden="true" />
                            )}
                        </button>
                    );
                })}
            </div>
        </section>
    );
}
