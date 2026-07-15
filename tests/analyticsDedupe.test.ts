import { describe, expect, it } from "vitest";
import { getAnalyticsTimeBucket, shouldCountPublicView } from "@/lib/analyticsDedupe";

describe("analytics dedupe policy", () => {
    it("uses a stable time bucket", () => {
        const first = Date.parse("2026-07-15T10:14:30.000Z");
        const second = Date.parse("2026-07-15T10:29:59.000Z");
        expect(getAnalyticsTimeBucket(first)).toBe("2026-07-15T10:00:00.000Z");
        expect(getAnalyticsTimeBucket(second)).toBe("2026-07-15T10:00:00.000Z");
    });

    it("counts only public published non-owner non-bot views", () => {
        expect(shouldCountPublicView({ isPublished: true, isPreview: false, isOwner: false, isBot: false })).toBe(true);
        expect(shouldCountPublicView({ isPublished: false, isPreview: false, isOwner: false, isBot: false })).toBe(false);
        expect(shouldCountPublicView({ isPublished: true, isPreview: true, isOwner: false, isBot: false })).toBe(false);
        expect(shouldCountPublicView({ isPublished: true, isPreview: false, isOwner: true, isBot: false })).toBe(false);
        expect(shouldCountPublicView({ isPublished: true, isPreview: false, isOwner: false, isBot: true })).toBe(false);
    });
});
