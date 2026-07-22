import type {
    BuilderMode,
    SaveStatus,
} from "@/features/builder/types";

type GetBuilderSaveStatusLabelOptions = {
    saveStatus: SaveStatus;
    builderMode: BuilderMode;
};

export function getBuilderSaveStatusLabel({
    saveStatus,
    builderMode,
}: GetBuilderSaveStatusLabelOptions): string {
    switch (saveStatus) {
        case "dirty":
            return "Unsaved changes";

        case "saving":
            return "Saving…";

        case "saved":
            return builderMode ===
                "published-edit"
                ? "Published"
                : "Saved";

        case "error":
            return "Save failed";

        default:
            return builderMode ===
                "published-edit"
                ? "Published"
                : "Saved";
    }
}