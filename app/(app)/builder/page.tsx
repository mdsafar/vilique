"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    AlertTriangle,
    CalendarDays,
    ChevronDown,
    ChevronLeft,
    Clock3,
    Eye,
    Loader2,
    Pause,
    PencilLine,
    Play,
    Rocket,
    Save,
    Smartphone,
    X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import AuthRequiredModal from "@/components/AuthRequiredModal";
import PublishModal from "@/components/PublishModal";
import MajorChangeModal from "@/components/MajorChangeModal";
import { useToast } from "@/components/Toast";
import { createDefaultInvitation } from "@/lib/defaultInvitation";
import { templates } from "@/data/templates";
import TemplateRenderer from "@/components/TemplateRenderer";
import type { InvitationData } from "@/types/invitation";

type EditorTab = "content" | "event" | "contact" | "sound";
type PreviewScreen = "invite" | "thanks";

const editorTabs: { id: EditorTab; label: string }[] = [
    { id: "content", label: "Content" },
    { id: "event", label: "Event" },
    { id: "contact", label: "Contact" },
    { id: "sound", label: "Sound" },
];

let activeSoundPreviewAudio: HTMLAudioElement | null = null;
let activeSoundPreviewStop: (() => void) | null = null;

function dispatchSoundPreviewState(isPlaying: boolean) {
    window.dispatchEvent(new Event(isPlaying ? "vilique:sound-preview-start" : "vilique:sound-preview-stop"));
}

export default function BuilderPage() {
    return (
        <Suspense fallback={<main className="builderShell" />}>
            <BuilderContent />
        </Suspense>
    );
}

function BuilderContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { showToast } = useToast();
    const [invitation, setInvitation] = useState(createDefaultInvitation());
    const [isLoadingInvitation, setIsLoadingInvitation] = useState(true);
    const [activeTab, setActiveTab] = useState<EditorTab>("content");
    const [previewScreen, setPreviewScreen] = useState<PreviewScreen>("invite");
    const [mobileEditorOpen, setMobileEditorOpen] = useState(false);
    const [saveState, setSaveState] = useState("Creating draft...");
    const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
    const [majorChangeError, setMajorChangeError] = useState<string | null>(null);
    const [leaveModalOpen, setLeaveModalOpen] = useState(false);
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [isPreviewing, setIsPreviewing] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [previewScrolledToBottom, setPreviewScrolledToBottom] = useState(false);
    const previewViewportRef = useRef<HTMLDivElement>(null);
    const lastSavedPayload = useRef("");
    const hasLoadedDraft = useRef(false);
    const createDraftPromise = useRef<Promise<InvitationData> | null>(null);
    const isNewDraft = useRef(true);
    const initialInvitation = useRef<InvitationData | null>(null);
    const openedFromExistingInvitation = useRef(false);
    const builderBackLabel = useRef("Templates");
    const builderBackTarget = useRef("/templates");
    const currentBuilderPath = `/builder${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
    const isPersistedDraft = invitation.id !== "default-draft-placeholder-id";
    const isEditingPublished = openedFromExistingInvitation.current && invitation.status === "published";

    useEffect(() => {
        if (!mobileEditorOpen) return;

        const scrollY = window.scrollY;
        const bodyStyle = document.body.style;
        const previousPosition = bodyStyle.position;
        const previousTop = bodyStyle.top;
        const previousWidth = bodyStyle.width;
        const previousOverflow = bodyStyle.overflow;

        bodyStyle.position = "fixed";
        bodyStyle.top = `-${scrollY}px`;
        bodyStyle.width = "100%";
        bodyStyle.overflow = "hidden";

        return () => {
            bodyStyle.position = previousPosition;
            bodyStyle.top = previousTop;
            bodyStyle.width = previousWidth;
            bodyStyle.overflow = previousOverflow;
            window.scrollTo(0, scrollY);
        };
    }, [mobileEditorOpen]);

    const selectedTemplate = useMemo(
        () => templates.find((item) => item.id === invitation.templateId),
        [invitation.templateId]
    );

    const buildSavePayload = useCallback((source: InvitationData = invitation) => {
        const safeEventDate = isValidDateValue(source.eventDate)
            ? source.eventDate
            : toDateInputValue(new Date());

        return JSON.stringify({
            slug: source.slug,
            category: source.category,
            title: source.title,
            primaryName: source.primaryName,
            secondaryName: source.secondaryName || null,
            eventDate: safeEventDate,
            eventTime: source.eventTime,
            venueName: source.venueName,
            venueAddress: source.venueAddress,
            mapLink: source.mapLink,
            phone: source.phone || null,
            whatsapp: source.whatsapp || null,
            message: source.message,
            musicUrl: source.musicUrl && source.musicUrl !== source.defaultMusicUrl ? source.musicUrl : null,
            coverImageUrl: source.coverImageUrl || null,
            galleryUrls: source.galleryUrls || [],
            theme: source.theme,
            sections: source.sections || {},
        });
    }, [invitation]);

    async function ensureDraftExists() {
        if (invitation.id !== "default-draft-placeholder-id") return invitation;
        if (createDraftPromise.current) return createDraftPromise.current;

        setSaveState("Creating draft...");
        const templateKey = searchParams.get("template") || invitation.templateId || "pastel-floral-wedding";
        createDraftPromise.current = fetch("/api/invitations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ templateKey }),
        })
            .then(async (response) => {
                const draft = await response.json();
                if (!response.ok) {
                    throw new Error(draft.error || "Could not create draft");
                }

                const nextInvitation = {
                    ...invitation,
                    ...draft,
                    id: draft.id,
                    slug: draft.slug,
                    title: invitation.title,
                    primaryName: invitation.primaryName,
                    secondaryName: invitation.secondaryName,
                    eventDate: invitation.eventDate,
                    eventTime: invitation.eventTime,
                    venueName: invitation.venueName,
                    venueAddress: invitation.venueAddress,
                    mapLink: invitation.mapLink,
                    phone: invitation.phone,
                    whatsapp: invitation.whatsapp,
                    message: invitation.message,
                    musicUrl: invitation.musicUrl,
                    theme: invitation.theme,
                    updatedAt: draft.updatedAt || new Date().toISOString(),
                };

                if (typeof window !== "undefined") {
                    sessionStorage.setItem(`vilique-new-draft-${draft.id}`, "true");
                    sessionStorage.setItem(`vilique-builder-back-target-${draft.id}`, builderBackTarget.current);
                    sessionStorage.setItem(`vilique-builder-back-label-${draft.id}`, builderBackLabel.current);
                }
                setInvitation(nextInvitation);
                router.replace(`/builder?id=${draft.id}`, { scroll: false });
                return nextInvitation;
            })
            .finally(() => {
                createDraftPromise.current = null;
            });

        return createDraftPromise.current;
    }

    async function saveInvitation(options: { createIfNeeded?: boolean; isExplicitUserSave?: boolean } = {}) {
        const source = options.createIfNeeded ? await ensureDraftExists() : invitation;
        if (source.id === "default-draft-placeholder-id") return null;

        const payload = buildSavePayload(source);
        if (payload === lastSavedPayload.current) {
            setSaveState("Saved");
            if (options.isExplicitUserSave) {
                isNewDraft.current = false;
                if (typeof window !== "undefined") {
                    sessionStorage.removeItem(`vilique-new-draft-${source.id}`);
                    sessionStorage.removeItem(`vilique-builder-back-target-${source.id}`);
                    sessionStorage.removeItem(`vilique-builder-back-label-${source.id}`);
                }
            }
            return source;
        }

        setSaveState("Saving...");
        const response = await fetch(`/api/invitations/${source.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: payload,
        });

        if (response.ok) {
            lastSavedPayload.current = payload;
            setSaveState("Saved");
            if (options.isExplicitUserSave) {
                isNewDraft.current = false;
                if (typeof window !== "undefined") {
                    sessionStorage.removeItem(`vilique-new-draft-${source.id}`);
                    sessionStorage.removeItem(`vilique-builder-back-target-${source.id}`);
                    sessionStorage.removeItem(`vilique-builder-back-label-${source.id}`);
                }
            }
            initialInvitation.current = source;
            return source;
        }

        const result = await response.json().catch(() => ({}));
        setSaveState(result.error || "Save failed");
        return null;
    }

    async function handleSaveDraft() {
        setIsSavingDraft(true);
        const saved = await saveInvitation({ createIfNeeded: true, isExplicitUserSave: true });
        if (saved) {
            router.push("/profile");
        } else {
            setIsSavingDraft(false);
        }
    }

    async function handleUpdateInvitation() {
        setIsPublishing(true);
        const saved = await saveInvitation({ createIfNeeded: true, isExplicitUserSave: true });
        setIsPublishing(false);
        if (saved) {
            setSaveState(invitation.status === "published" ? "Updated" : "Saved");
            showToast("Invitation updated successfully", "success");
            window.setTimeout(navigateBackToList, 450);
        }
    }

    function navigateBackToList() {
        router.replace(builderBackTarget.current);
    }

    async function saveAndPreview() {
        setIsPreviewing(true);
        const savedInvitation = await saveInvitation({ createIfNeeded: true });
        if (savedInvitation) {
            router.push(`/builder/preview?id=${savedInvitation.id}`);
        } else {
            setIsPreviewing(false);
        }
    }

    async function saveAndOpenPublish() {
        setIsPublishing(true);
        // Don't mark as explicit user save yet — user can still cancel out of the publish modal
        const savedInvitation = await saveInvitation({ createIfNeeded: true });
        setIsPublishing(false);
        if (savedInvitation) {
            setIsPublishModalOpen(true);
        }
    }

    async function handleDiscard() {
        const isPersisted = invitation.id !== "default-draft-placeholder-id";
        if (isPersisted) {
            if (isNewDraft.current) {
                // Delete the new draft since it was only created in this session (e.g. from Preview/file upload)
                await fetch(`/api/invitations/${invitation.id}`, {
                    method: "DELETE",
                });
            } else if (initialInvitation.current) {
                // Revert existing draft to pristine state when loaded
                await fetch(`/api/invitations/${invitation.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: buildSavePayload(initialInvitation.current),
                });
            }
        }
        navigateBackToList();
    }

    function updateField(key: string, value: string) {
        setInvitation((prev) => ({
            ...prev,
            [key]: value,
            updatedAt: new Date().toISOString(),
        }));
    }

    function updateTheme(key: keyof InvitationData["theme"], value: InvitationData["theme"][keyof InvitationData["theme"]]) {
        setInvitation((prev) => ({
            ...prev,
            theme: {
                ...prev.theme,
                [key]: value,
            },
            updatedAt: new Date().toISOString(),
        }));
    }

    async function updateMusicFile(file: File | null) {
        if (!file) {
            updateField("musicUrl", "");
            return;
        }

        const draft = await ensureDraftExists();
        setSaveState("Uploading music...");
        const formData = new FormData();
        formData.set("invitationId", draft.id);
        formData.set("kind", "music");
        formData.set("file", file);

        const response = await fetch("/api/media", {
            method: "POST",
            body: formData,
        });
        const result = await response.json();

        if (!response.ok) {
            setSaveState(result.error || "Music upload failed");
            return;
        }

        setInvitation((prev) => {
            if (prev.musicUrl?.startsWith("blob:")) {
                URL.revokeObjectURL(prev.musicUrl);
            }

            return {
                ...prev,
                musicUrl: result.url,
                updatedAt: new Date().toISOString(),
            };
        });
    }

    useEffect(() => {
        previewViewportRef.current?.scrollTo({ top: 0 });
        const frame = window.requestAnimationFrame(() => setPreviewScrolledToBottom(false));
        return () => window.cancelAnimationFrame(frame);
    }, [activeTab, previewScreen]);

    useEffect(() => {
        const viewport = previewViewportRef.current;
        if (!viewport) return;

        function handleScroll() {
            if (!viewport) return;
            const isBottom =
                viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 12;
            setPreviewScrolledToBottom(isBottom);
        }

        viewport.addEventListener("scroll", handleScroll, { passive: true });
        handleScroll();
        return () => viewport.removeEventListener("scroll", handleScroll);
    }, []);

    useEffect(() => {
        if (hasLoadedDraft.current) return;
        hasLoadedDraft.current = true;

        const existingId = searchParams.get("id");
        const templateKey = searchParams.get("template") || "pastel-floral-wedding";
        const openedFromProfile = searchParams.get("from") === "profile";
        const openedFromTemplateDetails = searchParams.get("from") === "template-details";

        const isSessionNewDraft = !openedFromProfile && existingId && typeof window !== "undefined"
            ? sessionStorage.getItem(`vilique-new-draft-${existingId}`) === "true"
            : !existingId;
        isNewDraft.current = !!isSessionNewDraft;
        openedFromExistingInvitation.current = openedFromProfile || (!!existingId && !isSessionNewDraft);

        if (openedFromExistingInvitation.current) {
            builderBackLabel.current = "Profile";
            builderBackTarget.current = "/profile";
        } else if (existingId && typeof window !== "undefined") {
            builderBackLabel.current = sessionStorage.getItem(`vilique-builder-back-label-${existingId}`) || "Templates";
            builderBackTarget.current = sessionStorage.getItem(`vilique-builder-back-target-${existingId}`) || "/templates";
        } else if (openedFromTemplateDetails) {
            builderBackLabel.current = "Templates";
            builderBackTarget.current = `/templates/${templateKey}`;
        } else {
            builderBackLabel.current = "Templates";
            builderBackTarget.current = "/templates";
        }

        async function loadDraft() {
            if (existingId) {
                const response = await fetch(`/api/invitations/${existingId}`);
                if (response.ok) {
                    const draft = normalizeInvitationDate(await response.json());
                    setInvitation(draft);
                    initialInvitation.current = draft;
                    lastSavedPayload.current = buildSavePayload(draft);
                    setSaveState(draft.status === "published" ? "Published" : "Saved");
                    setIsLoadingInvitation(false);
                    return;
                }
            }

            const defaultInv = {
                ...createDefaultInvitation(),
                templateId: templateKey,
                updatedAt: new Date().toISOString(),
            };
            const normalizedDefaultInv = normalizeInvitationDate(defaultInv);
            setInvitation(normalizedDefaultInv);
            initialInvitation.current = null;
            lastSavedPayload.current = buildSavePayload(normalizedDefaultInv);
            setSaveState("Not saved");
            setIsLoadingInvitation(false);
        }

        void loadDraft();
    }, [buildSavePayload, searchParams]);

    useEffect(() => {
        if (!hasLoadedDraft.current || !isPersistedDraft) return;

        const payload = buildSavePayload(invitation);

        if (payload === lastSavedPayload.current) return;
        setSaveState("Saving...");

        const timeout = window.setTimeout(async () => {
            const response = await fetch(`/api/invitations/${invitation.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: payload,
            });

            if (response.ok) {
                lastSavedPayload.current = payload;
                setSaveState("Saved");
                return;
            }

            const result = await response.json().catch(() => ({}));
            if (response.status === 409 && result.code === "MAJOR_CHANGE_DETECTED") {
                setMajorChangeError(result.error || "A major change has been detected.");
                setSaveState("Save blocked");
            } else {
                setSaveState(result.error || "Save failed");
            }
        }, 650);

        return () => window.clearTimeout(timeout);
    }, [buildSavePayload, invitation, isPersistedDraft]);

    if (isLoadingInvitation) {
        return <BuilderLoadingState />;
    }

    return (
        <main className="builderShell">
            <AuthRequiredModal next={currentBuilderPath} />
            <MajorChangeModal
                isOpen={!!majorChangeError}
                error={majorChangeError || ""}
                invitationId={invitation.id}
                onClose={() => {
                    setMajorChangeError(null);
                    window.location.reload();
                }}
            />

            <header className="builderTopbar">
                <button
                    type="button"
                    className="builderBack"
                    onClick={() => setLeaveModalOpen(true)}
                >
                    <ChevronLeft size={20} aria-hidden="true" />
                    <span>{builderBackLabel.current}</span>
                </button>

                <div className="builderTitle">
                    <span>{saveState}</span>
                    <strong>{selectedTemplate?.name || "Custom Template"}</strong>
                </div>

                <div aria-hidden="true" />
            </header>

            <section className="builderWorkspace">
                <aside className="editorPanel">
                    <div className="editorPanelHeader">
                        <div>
                            <p>Edit invitation</p>
                            <h2>{activeTab}</h2>
                        </div>
                    </div>

                    <EditorTabs activeTab={activeTab} setActiveTab={setActiveTab} />

                    <EditorForm
                        activeTab={activeTab}
                        invitation={invitation}
                        updateField={updateField}
                        updateTheme={updateTheme}
                        updateMusicFile={updateMusicFile}
                    />
                </aside>

                <section className="builderCanvas" aria-label="Invitation canvas">
                    <div className="previewColumn">
                        <div className="previewLabel">
                            <span>
                                <Smartphone size={15} aria-hidden="true" />
                                Live preview
                            </span>
                            <div className="previewMeta">
                                <div className="previewScreenToggle" aria-label="Preview screen">
                                    <button
                                        type="button"
                                        className={previewScreen === "invite" ? "active" : ""}
                                        onClick={() => setPreviewScreen("invite")}
                                    >
                                        Invite
                                    </button>
                                    <button
                                        type="button"
                                        className={previewScreen === "thanks" ? "active" : ""}
                                        onClick={() => setPreviewScreen("thanks")}
                                    >
                                        Thanks
                                    </button>
                                </div>
                                <b>390px</b>
                            </div>
                        </div>

                        <div className="previewDevice">
                            <div className="previewViewport" ref={previewViewportRef}>
                                <div className="previewScaleFrame">
                                    <TemplateRenderer
                                        invitation={invitation}
                                        accepted={previewScreen === "thanks"}
                                        onAccept={() => setPreviewScreen("thanks")}
                                        onDecline={() => setPreviewScreen("invite")}
                                        enableAudio
                                    />
                                </div>
                            </div>
                            {!previewScrolledToBottom && (
                                <div className="previewScrollHint" aria-hidden="true">
                                    <ChevronDown size={16} />
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            </section>

            <button
                className="mobileEditorTrigger"
                type="button"
                onClick={() => setMobileEditorOpen(true)}
            >
                <PencilLine size={17} aria-hidden="true" />
                Edit {activeTab}
            </button>

            <button
                className={`mobileSheetScrim ${mobileEditorOpen ? "active" : ""}`}
                type="button"
                aria-label="Close editor"
                onClick={() => setMobileEditorOpen(false)}
            />

            <section className={`mobileBuilderSheet ${mobileEditorOpen ? "active" : ""}`}>
                <div className="sheetHandle" />
                <div className="mobileSheetHeader">
                    <div>
                        <p>Edit invitation</p>
                        <h2>{activeTab}</h2>
                    </div>
                    <button type="button" onClick={() => setMobileEditorOpen(false)} aria-label="Close editor">
                        <X size={18} aria-hidden="true" />
                    </button>
                </div>
                <EditorTabs activeTab={activeTab} setActiveTab={setActiveTab} />

                <EditorForm
                    activeTab={activeTab}
                    invitation={invitation}
                    updateField={updateField}
                    updateTheme={updateTheme}
                    updateMusicFile={updateMusicFile}
                />
            </section>

            <div className="builderBottomBar">
                {!isEditingPublished ? (
                    <button type="button" onClick={handleSaveDraft} disabled={isSavingDraft || isPreviewing || isPublishing}>
                        {isSavingDraft ? <Loader2 size={17} className="spinner" /> : <Save size={17} aria-hidden="true" />}
                        <span>Save Draft</span>
                    </button>
                ) : null}
                <button type="button" onClick={saveAndPreview} disabled={isSavingDraft || isPreviewing || isPublishing}>
                    {isPreviewing ? <Loader2 size={17} className="spinner" /> : <Eye size={17} aria-hidden="true" />}
                    <span>Preview</span>
                </button>
                <button
                    type="button"
                    onClick={isEditingPublished ? handleUpdateInvitation : saveAndOpenPublish}
                    disabled={isSavingDraft || isPreviewing || isPublishing}
                >
                    {isPublishing ? <Loader2 size={17} className="spinner" /> : <Rocket size={17} aria-hidden="true" />}
                    <span>
                        {isPublishing
                            ? isEditingPublished ? "Updating..." : "Publishing..."
                            : isEditingPublished ? "Update" : "Publish"}
                    </span>
                </button>
            </div>

            <LeaveModal
                isOpen={leaveModalOpen}
                mode={isEditingPublished ? "update" : "draft"}
                onSave={async () => {
                    const savedInvitation = await saveInvitation({ createIfNeeded: true, isExplicitUserSave: true });
                    if (savedInvitation) navigateBackToList();
                }}
                onDiscard={handleDiscard}
                onCancel={() => setLeaveModalOpen(false)}
            />

            <PublishModal
                invitation={invitation}
                isOpen={isPublishModalOpen}
                onClose={() => setIsPublishModalOpen(false)}
                onPublishSuccess={(updatedInvitation) => {
                    // Mark as explicitly saved since user completed publishing
                    isNewDraft.current = false;
                    if (typeof window !== "undefined" && invitation.id) {
                        sessionStorage.removeItem(`vilique-new-draft-${invitation.id}`);
                        sessionStorage.removeItem(`vilique-builder-back-target-${invitation.id}`);
                        sessionStorage.removeItem(`vilique-builder-back-label-${invitation.id}`);
                    }
                    setInvitation((prev) => ({
                        ...prev,
                        status: updatedInvitation.status,
                        publishedAt: updatedInvitation.published_at || undefined,
                        slug: updatedInvitation.slug,
                        updatedAt: new Date().toISOString(),
                    }));
                    setSaveState(updatedInvitation.status === "published" ? "Published" : "Saved");
                    if (updatedInvitation.status === "published") {
                        navigateBackToList();
                    }
                }}
            />
        </main>
    );
}

function BuilderLoadingState() {
    return (
        <main className="builderShell builderLoadingShell" aria-busy="true">
            <div className="builderLoadingCard">
                <Loader2 className="spinner" size={28} aria-hidden="true" />
                <div>
                    <strong>Opening builder</strong>
                    <span>Loading your invitation</span>
                </div>
            </div>
        </main>
    );
}

function LeaveModal({
    isOpen,
    mode,
    onSave,
    onDiscard,
    onCancel,
}: {
    isOpen: boolean;
    mode: "draft" | "update";
    onSave: () => Promise<void>;
    onDiscard: () => void;
    onCancel: () => void;
}) {
    const [saving, setSaving] = useState(false);

    // Prevent background scrolling when open
    useEffect(() => {
        if (!isOpen) return;

        const scrollY = window.scrollY;
        const previousBodyOverflow = document.body.style.overflow;
        const previousBodyPosition = document.body.style.position;
        const previousBodyTop = document.body.style.top;
        const previousBodyWidth = document.body.style.width;
        const previousHtmlOverflow = document.documentElement.style.overflow;

        document.documentElement.style.overflow = "hidden";
        document.body.style.overflow = "hidden";
        document.body.style.position = "fixed";
        document.body.style.top = `-${scrollY}px`;
        document.body.style.width = "100%";

        return () => {
            document.documentElement.style.overflow = previousHtmlOverflow;
            document.body.style.overflow = previousBodyOverflow;
            document.body.style.position = previousBodyPosition;
            document.body.style.top = previousBodyTop;
            document.body.style.width = previousBodyWidth;
            window.scrollTo(0, scrollY);
        };
    }, [isOpen]);

    if (typeof document === "undefined") return null;

    async function handleSave() {
        setSaving(true);
        await onSave();
        setSaving(false);
    }

    const isUpdateMode = mode === "update";

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div
                    className="modalOverlay"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Save changes"
                >
                    <motion.div
                        className="modalBackdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onCancel}
                    />

                    <motion.section
                        initial={{ opacity: 0, scale: 0.94, y: 18 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.94, y: 18 }}
                        transition={{ type: "spring", stiffness: 320, damping: 28 }}
                        style={{
                            position: "relative",
                            zIndex: 1,
                            width: "min(100%, 380px)",
                            background: "#ffffff",
                            border: "1px solid rgba(23,23,23,0.08)",
                            borderRadius: "24px",
                            padding: "28px 24px 24px",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: "14px",
                            textAlign: "center",
                            boxShadow: "0 24px 60px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.9)",
                        }}
                    >
                        {/* Icon */}
                        <div style={{
                            width: "52px",
                            height: "52px",
                            borderRadius: "16px",
                            background: "rgba(251,191,36,0.1)",
                            border: "1px solid rgba(251,191,36,0.3)",
                            display: "grid",
                            placeItems: "center",
                            color: "#d97706",
                        }}>
                            <AlertTriangle size={24} strokeWidth={2} />
                        </div>

                        {/* Title */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            <h2 style={{
                                margin: 0,
                                fontSize: "18px",
                                fontWeight: 800,
                                color: "#111827",
                                fontFamily: "Arial, Helvetica, sans-serif",
                                letterSpacing: "-0.02em",
                            }}>
                                {isUpdateMode ? "Discard changes?" : "Save before leaving?"}
                            </h2>
                            <p style={{
                                margin: 0,
                                fontSize: "13px",
                                color: "#6b7280",
                                lineHeight: 1.5,
                            }}>
                                {isUpdateMode
                                    ? "Your live invitation has unsaved changes. Discard them or keep editing."
                                    : "Your invitation has unsaved changes. Would you like to save your draft before going back?"
                                }
                            </p>
                        </div>

                        {/* Actions */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%", marginTop: "4px" }}>
                            {!isUpdateMode ? (
                                <button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={saving}
                                    style={{
                                        width: "100%",
                                        minHeight: "46px",
                                        borderRadius: "14px",
                                        border: "none",
                                        background: saving
                                            ? "#e5e7eb"
                                            : "linear-gradient(135deg, #8c4cf3 0%, #c46fb4 100%)",
                                        color: saving ? "#9ca3af" : "#fff",
                                        fontWeight: 800,
                                        fontSize: "14px",
                                        cursor: saving ? "not-allowed" : "pointer",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: "8px",
                                        transition: "all 0.2s",
                                        boxShadow: saving ? "none" : "0 4px 16px rgba(140, 76, 243, 0.3)",
                                    }}
                                >
                                    <Save size={15} />
                                    {saving ? "Saving…" : "Save Draft"}
                                </button>
                            ) : null}

                            {/* Discard & Keep Editing row */}
                            <div style={{ display: "flex", gap: "8px" }}>
                                <button
                                    type="button"
                                    onClick={onDiscard}
                                    disabled={saving}
                                    style={{
                                        flex: 1,
                                        minHeight: "42px",
                                        borderRadius: "12px",
                                        background: "#fef2f2",
                                        border: "1.5px solid rgba(239,68,68,0.2)",
                                        color: "#dc2626",
                                        fontWeight: 700,
                                        fontSize: "13.5px",
                                        cursor: saving ? "not-allowed" : "pointer",
                                        transition: "all 0.2s",
                                    }}
                                >
                                    Discard
                                </button>
                                <button
                                    type="button"
                                    onClick={onCancel}
                                    disabled={saving}
                                    style={{
                                        flex: 1,
                                        minHeight: "42px",
                                        borderRadius: "12px",
                                        background: "#f9fafb",
                                        border: "1.5px solid #e5e7eb",
                                        color: "#6b7280",
                                        fontWeight: 700,
                                        fontSize: "13.5px",
                                        cursor: saving ? "not-allowed" : "pointer",
                                        transition: "all 0.2s",
                                    }}
                                >
                                    Keep Editing
                                </button>
                            </div>
                        </div>
                    </motion.section>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
}


function EditorTabs({
    activeTab,
    setActiveTab,
}: {
    activeTab: EditorTab;
    setActiveTab: (tab: EditorTab) => void;
}) {
    return (
        <div className="editorTabs">
            {editorTabs.map(({ id, label }) => (
                <button
                    key={id}
                    className={activeTab === id ? "active" : ""}
                    onClick={() => setActiveTab(id)}
                >
                    {label}
                </button>
            ))}
        </div>
    );
}

function EditorForm({
    activeTab,
    invitation,
    updateField,
    updateTheme,
    updateMusicFile,
}: {
    activeTab: EditorTab;
    invitation: ReturnType<typeof createDefaultInvitation>;
    updateField: (key: string, value: string) => void;
    updateTheme: (key: keyof InvitationData["theme"], value: InvitationData["theme"][keyof InvitationData["theme"]]) => void;
    updateMusicFile: (file: File | null) => void;
}) {
    const { startTime, endTime } = parseTimeRange(invitation.eventTime);

    if (activeTab === "content") {
        return (
            <div className="editorForm">
                <label>
                    <span>Title</span>
                    <input value={invitation.title} onChange={(e) => updateField("title", e.target.value)} maxLength={45} />
                </label>

                <label>
                    <span>Primary Name</span>
                    <input value={invitation.primaryName} onChange={(e) => updateField("primaryName", e.target.value)} maxLength={25} />
                </label>

                <label>
                    <span>Secondary Name</span>
                    <input value={invitation.secondaryName || ""} onChange={(e) => updateField("secondaryName", e.target.value)} maxLength={25} />
                </label>

                <label>
                    <span>Message</span>
                    <textarea value={invitation.message} onChange={(e) => updateField("message", e.target.value)} maxLength={200} />
                </label>
            </div>
        );
    }

    if (activeTab === "event") {
        return (
            <div className="editorForm">
                <label>
                    <span>Date</span>
                    <DatePickerField
                        value={invitation.eventDate}
                        onChange={(value) => updateField("eventDate", value)}
                    />
                </label>

                <label>
                    <span>Start Time</span>
                    <TimePickerField
                        value={startTime}
                        onChange={(value) => updateField("eventTime", formatTimeRange(value, endTime))}
                    />
                </label>

                <label>
                    <span>End Time</span>
                    <TimePickerField
                        value={endTime}
                        onChange={(value) => updateField("eventTime", formatTimeRange(startTime, value))}
                    />
                </label>

                <label>
                    <span>Venue Name</span>
                    <input value={invitation.venueName} onChange={(e) => updateField("venueName", e.target.value)} maxLength={45} />
                </label>

                <label>
                    <span>Venue Address</span>
                    <textarea value={invitation.venueAddress} onChange={(e) => updateField("venueAddress", e.target.value)} maxLength={120} />
                </label>
            </div>
        );
    }

    if (activeTab === "contact") {
        return (
            <div className="editorForm">
                <label>
                    <span>Phone / WhatsApp</span>
                    <input
                        type="tel"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={invitation.phone || ""}
                        onChange={(e) => updateField("phone", e.target.value.replace(/\D/g, ""))}
                        maxLength={15}
                    />
                </label>

                <label>
                    <span>Map Link</span>
                    <input
                        type="url"
                        inputMode="url"
                        value={invitation.mapLink}
                        onChange={(e) => updateField("mapLink", e.target.value)}
                        maxLength={250}
                    />
                </label>
            </div>
        );
    }

    const durationOptions = [
        { value: 5, label: "5s" },
        { value: 10, label: "10s" },
        { value: 15, label: "15s" },
        { value: 20, label: "20s" },
    ];

    const defaultMusicUrl = invitation.musicUrl || invitation.defaultMusicUrl || "";
    const defaultTickUrl = invitation.tickSoundUrl || invitation.theme?.tickSoundUrl || invitation.defaultTickSoundUrl || "";
    // A custom song exists when musicUrl is a user-uploaded URL rather than the template default.
    const hasCustomSong = !!invitation.musicUrl && invitation.musicUrl !== invitation.defaultMusicUrl;

    return (
        <div className="editorForm">
            {/* ── Celebration Song ── */}
            <label style={{ display: "block", marginBottom: "4px" }}>
                <span>Celebration Song</span>
                <SoundPreviewCard
                    icon="🎵"
                    title={hasCustomSong ? "Custom Song" : "Default Celebration Song"}
                    subtitle={
                        defaultMusicUrl
                            ? defaultMusicUrl.split("/").pop() || "song.mp3"
                            : "No song uploaded yet"
                    }
                    url={defaultMusicUrl || undefined}
                    badge={hasCustomSong ? "custom" : defaultMusicUrl ? "default" : undefined}
                    onRemove={hasCustomSong ? () => updateMusicFile(null) : undefined}
                    onUpload={(file) => updateMusicFile(file)}
                    uploadId="musicUploadInput"
                />
            </label>

            {/* ── Clock Ticking Sound (read-only) ── */}
            <label style={{ display: "block", marginBottom: "4px" }}>
                <span>Clock Ticking Sound</span>
                <SoundPreviewCard
                    icon="⏰"
                    title="Default Ticking Sound"
                    subtitle={
                        defaultTickUrl
                            ? defaultTickUrl.split("/").pop() || "tick-tock.mp3"
                            : "No tick sound configured"
                    }
                    url={defaultTickUrl || undefined}
                    badge="default"
                />
                <p style={{
                    fontSize: "10px",
                    color: "#9ca3af",
                    marginTop: "6px",
                    lineHeight: 1.35,
                    paddingLeft: "2px",
                }}>
                    This sound plays in the background automatically. It&apos;s set by the template and cannot be changed.
                </p>
            </label>

            {/* ── Play Duration ── */}
            <label>
                <span>Song Play Duration</span>
                <div style={{ display: "flex", gap: "7px", marginTop: "7px" }}>
                    {durationOptions.map((opt) => {
                        const isSelected = (invitation.theme?.musicDuration ?? 20) === opt.value;
                        return (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => updateTheme("musicDuration", opt.value)}
                                style={{
                                    flex: 1,
                                    minHeight: "38px",
                                    borderRadius: "12px",
                                    border: isSelected ? "2px solid #7e5bd5" : "1px solid rgba(23, 23, 23, 0.08)",
                                    background: isSelected
                                        ? "linear-gradient(135deg, #3b2a3a 0%, #7e5bd5 100%)"
                                        : "#fff",
                                    color: isSelected ? "#fff" : "#4b5563",
                                    fontSize: "13px",
                                    fontWeight: isSelected ? 800 : 650,
                                    cursor: "pointer",
                                    transition: "all 0.2s",
                                    boxShadow: isSelected ? "0 3px 10px rgba(126,91,213,0.24)" : "none",
                                }}
                            >
                                {opt.label}
                            </button>
                        );
                    })}
                </div>
            </label>
        </div>
    );
}

function DatePickerField({
    value,
    onChange,
}: {
    value: string;
    onChange: (value: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const fallbackDate = useMemo(() => new Date(), []);
    const selectedDate = parseDateValue(value) || fallbackDate;
    const [visibleMonth, setVisibleMonth] = useState(() => selectedDate || new Date());
    const calendarDays = getCalendarDays(visibleMonth);

    useEffect(() => {
        if (!isValidDateValue(value)) {
            onChange(toDateInputValue(fallbackDate));
        }
    }, [fallbackDate, onChange, value]);

    function selectDate(date: Date) {
        onChange(toDateInputValue(date));
        setVisibleMonth(date);
        setOpen(false);
    }

    return (
        <div className="customPicker">
            <button
                className="customPickerTrigger"
                type="button"
                onClick={() => setOpen((current) => !current)}
            >
                <span>{formatDisplayDate(selectedDate)}</span>
                <CalendarDays size={18} aria-hidden="true" />
            </button>

            {open ? (
                <div className="customPickerPopover datePickerPopover">
                    <div className="customPickerHeader">
                        <strong>
                            {visibleMonth.toLocaleString("en", { month: "long", year: "numeric" })}
                        </strong>
                        <div>
                            <button type="button" onClick={() => setVisibleMonth(addMonths(visibleMonth, -1))} aria-label="Previous month">
                                <ChevronLeft size={17} aria-hidden="true" />
                            </button>
                            <button type="button" onClick={() => setVisibleMonth(addMonths(visibleMonth, 1))} aria-label="Next month">
                                <ChevronLeft size={17} aria-hidden="true" />
                            </button>
                        </div>
                    </div>

                    <div className="datePickerGrid">
                        {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
                            <b key={`${day}-${index}`}>{day}</b>
                        ))}
                        {calendarDays.map((date) => {
                            const isCurrentMonth = date.getMonth() === visibleMonth.getMonth();
                            const isSelected = selectedDate ? isSameDate(date, selectedDate) : false;

                            return (
                                <button
                                    className={isSelected ? "selected" : !isCurrentMonth ? "muted" : undefined}
                                    key={date.toISOString()}
                                    type="button"
                                    onClick={() => selectDate(date)}
                                >
                                    {date.getDate()}
                                </button>
                            );
                        })}
                    </div>

                    <div className="customPickerFooter single">
                        <button type="button" onClick={() => selectDate(new Date())}>Today</button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

function TimePickerField({
    value,
    onChange,
}: {
    value: string;
    onChange: (value: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const parsed = parseTimeInputParts(value);

    function updateTime(next: Partial<ReturnType<typeof parseTimeInputParts>>) {
        onChange(toTimeInputFromParts({ ...parsed, ...next }));
    }

    return (
        <div className="customPicker">
            <button
                className="customPickerTrigger"
                type="button"
                onClick={() => setOpen((current) => !current)}
            >
                <span>{value ? fromTimeInputValue(value) : "Select time"}</span>
                <Clock3 size={18} aria-hidden="true" />
            </button>

            {open ? (
                <div className="customPickerPopover timePickerPopover">
                    <div className="timePickerColumns">
                        <PickerColumn
                            values={Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0"))}
                            selected={parsed.hour}
                            onSelect={(hour) => updateTime({ hour })}
                        />
                        <PickerColumn
                            values={Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"))}
                            selected={parsed.minute}
                            onSelect={(minute) => updateTime({ minute })}
                        />
                        <PickerColumn
                            values={["AM", "PM"]}
                            selected={parsed.period}
                            onSelect={(period) => updateTime({ period: period as "AM" | "PM" })}
                        />
                    </div>

                    <div className="customPickerFooter single">
                        <button type="button" onClick={() => setOpen(false)}>Done</button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

function PickerColumn({
    values,
    selected,
    onSelect,
}: {
    values: string[];
    selected: string;
    onSelect: (value: string) => void;
}) {
    return (
        <div className="timePickerColumn">
            {values.map((value) => (
                <button
                    className={value === selected ? "selected" : undefined}
                    key={value}
                    type="button"
                    onClick={() => onSelect(value)}
                >
                    {value}
                </button>
            ))}
        </div>
    );
}

function parseTimeRange(value: string) {
    const [rawStart = "", rawEnd = ""] = value.split(/\s*[-–—]\s*/).map((part) => part.trim());

    return {
        startTime: toTimeInputValue(rawStart),
        endTime: toTimeInputValue(rawEnd),
    };
}

function parseTimeInputParts(value: string) {
    const [hours = "09", minutes = "00"] = (value || "09:00").split(":");
    const hours24 = Number(hours);
    const period = hours24 >= 12 ? "PM" : "AM";
    const hour = String(hours24 % 12 || 12).padStart(2, "0");

    return {
        hour,
        minute: String(Number(minutes) || 0).padStart(2, "0"),
        period,
    } as const;
}

function toTimeInputFromParts({
    hour,
    minute,
    period,
}: {
    hour: string;
    minute: string;
    period: "AM" | "PM";
}) {
    let hours = Number(hour);
    if (period === "PM" && hours < 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;

    return `${String(hours).padStart(2, "0")}:${minute}`;
}

function parseDateValue(value: string) {
    if (!value) return null;
    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
}

function isValidDateValue(value: string) {
    return parseDateValue(value) !== null;
}

function toDateInputValue(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDisplayDate(date: Date) {
    return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    }).format(date);
}

function addMonths(date: Date, amount: number) {
    return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function getCalendarDays(month: Date) {
    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = new Date(firstDay);
    start.setDate(firstDay.getDate() - firstDay.getDay());

    return Array.from({ length: 42 }, (_, index) => {
        const date = new Date(start);
        date.setDate(start.getDate() + index);
        return date;
    });
}

function isSameDate(left: Date, right: Date) {
    return left.getFullYear() === right.getFullYear() &&
        left.getMonth() === right.getMonth() &&
        left.getDate() === right.getDate();
}

function normalizeInvitationDate<T extends InvitationData>(invitation: T): T {
    if (isValidDateValue(invitation.eventDate)) return invitation;

    return {
        ...invitation,
        eventDate: toDateInputValue(new Date()),
    };
}

function toTimeInputValue(value: string) {
    const normalized = value.trim().toUpperCase();
    if (!normalized) return "";

    const match = normalized.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/);
    if (!match) return "";

    let hours = Number(match[1]);
    const minutes = Number(match[2] || "00");
    const meridiem = match[3];

    if (Number.isNaN(hours) || Number.isNaN(minutes) || hours > 23 || minutes > 59) return "";

    if (meridiem === "PM" && hours < 12) hours += 12;
    if (meridiem === "AM" && hours === 12) hours = 0;

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatTimeRange(startTime: string, endTime: string) {
    const startLabel = fromTimeInputValue(startTime);
    const endLabel = fromTimeInputValue(endTime);

    if (startLabel && endLabel) return `${startLabel} - ${endLabel}`;
    return startLabel || endLabel;
}

function fromTimeInputValue(value: string) {
    if (!value) return "";

    const [rawHours = "0", rawMinutes = "00"] = value.split(":");
    const hours24 = Number(rawHours);
    const minutes = Number(rawMinutes);
    if (Number.isNaN(hours24) || Number.isNaN(minutes)) return "";

    const meridiem = hours24 >= 12 ? "PM" : "AM";
    const hours12 = hours24 % 12 || 12;

    return `${String(hours12).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${meridiem}`;
}



function useAudioPreview(url: string | undefined) {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [playing, setPlaying] = useState(false);

    useEffect(() => {
        return () => {
            if (activeSoundPreviewAudio === audioRef.current) {
                activeSoundPreviewAudio = null;
                activeSoundPreviewStop = null;
            }
            audioRef.current?.pause();
        };
    }, []);

    function stopPreview() {
        if (!audioRef.current) return;
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        if (activeSoundPreviewAudio === audioRef.current) {
            activeSoundPreviewAudio = null;
            activeSoundPreviewStop = null;
        }
        dispatchSoundPreviewState(false);
        setPlaying(false);
    }

    function toggle() {
        if (!url) return;
        if (!audioRef.current) {
            audioRef.current = new Audio(url);
            audioRef.current.volume = 0.5;
            audioRef.current.onended = stopPreview;
        }
        if (playing) {
            stopPreview();
        } else {
            activeSoundPreviewStop?.();
            activeSoundPreviewAudio = audioRef.current;
            activeSoundPreviewStop = stopPreview;
            dispatchSoundPreviewState(true);
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current.src = url;
            void audioRef.current.play().then(() => setPlaying(true)).catch(() => {
                if (activeSoundPreviewAudio === audioRef.current) {
                    activeSoundPreviewAudio = null;
                    activeSoundPreviewStop = null;
                }
                dispatchSoundPreviewState(false);
                setPlaying(false);
            });
        }
    }

    return { playing, toggle };
}

function SoundPreviewCard({
    icon,
    title,
    subtitle,
    url,
    badge,
    onRemove,
    onUpload,
    uploadId,
}: {
    icon: string;
    title: string;
    subtitle: string;
    url?: string;
    badge?: "default" | "custom";
    onRemove?: () => void;
    onUpload?: (file: File) => void;
    uploadId?: string;
}) {
    const { playing, toggle } = useAudioPreview(url);

    return (
        <div style={{
            borderRadius: "13px",
            border: "1px solid rgba(126, 91, 213, 0.12)",
            background: badge === "custom"
                ? "rgba(126, 91, 213, 0.04)"
                : "rgba(248, 246, 255, 0.9)",
            overflow: "hidden",
            marginTop: "7px",
        }}>
            <div style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "12px 13px",
            }}>
                <span style={{ fontSize: "20px", lineHeight: 1 }}>{icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "1px" }}>
                        <span style={{ fontSize: "12px", fontWeight: 850, color: "#1a1a1a", letterSpacing: "0.02em" }}>{title}</span>
                        {badge && (
                            <span style={{
                                fontSize: "8px",
                                fontWeight: 800,
                                padding: "1px 5px",
                                borderRadius: "999px",
                                background: badge === "custom" ? "rgba(126, 91, 213, 0.12)" : "rgba(16, 185, 129, 0.1)",
                                color: badge === "custom" ? "#7e5bd5" : "#059669",
                                textTransform: "uppercase",
                                letterSpacing: "0.06em",
                            }}>
                                {badge === "custom" ? "Custom" : "Default"}
                            </span>
                        )}
                    </div>
                    <span style={{ fontSize: "10.5px", color: "#9ca3af", wordBreak: "break-all", lineHeight: 1.22 }}>
                        {subtitle}
                    </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                    {url && (
                        <button
                            type="button"
                            onClick={toggle}
                            style={{
                                width: "34px",
                                minWidth: "34px",
                                height: "34px",
                                minHeight: "34px",
                                aspectRatio: "1 / 1",
                                padding: 0,
                                borderRadius: "50%",
                                border: "none",
                                background: playing
                                    ? "linear-gradient(135deg, #3b2a3a 0%, #7e5bd5 100%)"
                                    : "rgba(126, 91, 213, 0.1)",
                                color: playing ? "white" : "#7e5bd5",
                                display: "grid",
                                placeItems: "center",
                                lineHeight: 0,
                                cursor: "pointer",
                                transition: "all 0.2s",
                                flex: "0 0 34px",
                            }}
                        >
                            {playing ? <Pause size={12} /> : <Play size={12} />}
                        </button>
                    )}
                    {onRemove && (
                        <button
                            type="button"
                            onClick={onRemove}
                            style={{
                                height: "28px",
                                padding: "0 9px",
                                borderRadius: "8px",
                                background: "#fee2e2",
                                color: "#ef4444",
                                fontSize: "10px",
                                fontWeight: 800,
                                border: "none",
                                cursor: "pointer",
                                flexShrink: 0,
                            }}
                        >
                            Remove
                        </button>
                    )}
                </div>
            </div>
            {onUpload && uploadId && (
                <div style={{
                    borderTop: "1px dashed rgba(126, 91, 213, 0.12)",
                    padding: "10px 13px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                }}
                    onClick={() => document.getElementById(uploadId)?.click()}
                >
                    <span style={{ fontSize: "12px" }}>📤</span>
                    <span style={{ fontSize: "11.5px", color: "#7e5bd5", fontWeight: 750, letterSpacing: "0.015em" }}>
                        Upload custom song to replace
                    </span>
                    <input
                        id={uploadId}
                        type="file"
                        accept="audio/*"
                        style={{ display: "none" }}
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) onUpload(file);
                        }}
                    />
                </div>
            )}
        </div>
    );
}
