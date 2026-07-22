export type EditorTab =
    | "content"
    | "event"
    | "contact"
    | "sound";

export type BuilderUpdateSource =
    | "user"
    | "programmatic";

export type PreviewScreen =
    | "invite"
    | "thanks";

export type PreviewDeviceMode =
    | "mobile"
    | "desktop";

export type BuilderMode =
    | "new"
    | "draft-edit"
    | "published-edit";

export type SaveStatus =
    | "idle"
    | "dirty"
    | "saving"
    | "saved"
    | "readonly"
    | "error";

export type PublishSuccessDetails = {
    slug: string;
    publishedAt?: string | null;
};
