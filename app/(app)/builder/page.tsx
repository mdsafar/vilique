"use client";

import { Suspense, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    ChevronDown,
    ChevronLeft,
    Eye,
    Pause,
    PencilLine,
    Play,
    Rocket,
    Save,
    Smartphone,
    X,
} from "lucide-react";
import AuthRequiredModal from "@/components/AuthRequiredModal";
import PublishModal from "@/components/PublishModal";
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
    window.dispatchEvent(new Event(isPlaying ? "viliqu:sound-preview-start" : "viliqu:sound-preview-stop"));
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
    const [invitation, setInvitation] = useState(createDefaultInvitation());
    const [activeTab, setActiveTab] = useState<EditorTab>("content");
    const [previewScreen, setPreviewScreen] = useState<PreviewScreen>("invite");
    const [mobileEditorOpen, setMobileEditorOpen] = useState(false);
    const [saveState, setSaveState] = useState("Creating draft...");
    const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
    const [leaveModalOpen, setLeaveModalOpen] = useState(false);
    const [previewScrolledToBottom, setPreviewScrolledToBottom] = useState(false);
    const previewViewportRef = useRef<HTMLDivElement>(null);
    const lastSavedPayload = useRef("");
    const hasLoadedDraft = useRef(false);
    const createDraftPromise = useRef<Promise<InvitationData> | null>(null);
    const isNewDraft = useRef(true);
    const initialInvitation = useRef<InvitationData | null>(null);
    const currentBuilderPath = `/builder${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
    const isPersistedDraft = invitation.id !== "default-draft-placeholder-id";

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

    function buildSavePayload(source: InvitationData = invitation) {
        return JSON.stringify({
            slug: source.slug,
            category: source.category,
            title: source.title,
            primaryName: source.primaryName,
            secondaryName: source.secondaryName || null,
            eventDate: source.eventDate,
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
    }

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

                setInvitation(nextInvitation);
                router.replace(`/builder?id=${draft.id}`);
                return nextInvitation;
            })
            .finally(() => {
                createDraftPromise.current = null;
            });

        return createDraftPromise.current;
    }

    async function saveInvitation(options: { createIfNeeded?: boolean } = {}) {
        const source = options.createIfNeeded ? await ensureDraftExists() : invitation;
        if (source.id === "default-draft-placeholder-id") return null;

        const payload = buildSavePayload(source);
        if (payload === lastSavedPayload.current) {
            setSaveState("Saved");
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
            isNewDraft.current = false;
            initialInvitation.current = source;
            return source;
        }

        const result = await response.json().catch(() => ({}));
        setSaveState(result.error || "Save failed");
        return null;
    }

    async function saveAndPreview() {
        const savedInvitation = await saveInvitation({ createIfNeeded: true });
        if (savedInvitation) {
            router.push(`/builder/preview?id=${savedInvitation.id}`);
        }
    }

    async function saveAndOpenPublish() {
        const savedInvitation = await saveInvitation({ createIfNeeded: true });
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
        router.push("/templates");
    }

    function updateField(key: string, value: string) {
        setInvitation((prev) => ({
            ...prev,
            [key]: value,
            updatedAt: new Date().toISOString(),
        }));
    }

    function updateTheme(key: string, value: any) {
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

    async function updateTickFile(file: File | null) {
        if (!file) {
            updateTheme("tickSoundUrl", "");
            return;
        }

        const draft = await ensureDraftExists();
        setSaveState("Uploading ticking sound...");
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
            setSaveState(result.error || "Ticking sound upload failed");
            return;
        }

        updateTheme("tickSoundUrl", result.url);
        setSaveState("Saved");
    }

    useEffect(() => {
        previewViewportRef.current?.scrollTo({ top: 0 });
        setPreviewScrolledToBottom(false);
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

        isNewDraft.current = !existingId;

        async function loadDraft() {
            if (existingId) {
                const response = await fetch(`/api/invitations/${existingId}`);
                if (response.ok) {
                    const draft = await response.json();
                    setInvitation(draft);
                    initialInvitation.current = draft;
                    lastSavedPayload.current = buildSavePayload(draft);
                    setSaveState("Saved");
                    return;
                }
            }

            setInvitation((prev) => ({
                ...prev,
                templateId: templateKey,
                updatedAt: new Date().toISOString(),
            }));
            initialInvitation.current = null;
            setSaveState("Not saved");
        }

        void loadDraft();
    }, [searchParams]);

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
            setSaveState(result.error || "Save failed");
        }, 650);

        return () => window.clearTimeout(timeout);
    }, [invitation, isPersistedDraft]);

    return (
        <main className="builderShell">
            <AuthRequiredModal next={currentBuilderPath} />

            <header className="builderTopbar">
                <button
                    type="button"
                    className="builderBack"
                    onClick={() => setLeaveModalOpen(true)}
                >
                    <ChevronLeft size={20} aria-hidden="true" />
                    <span>Templates</span>
                </button>

                <div className="builderTitle">
                    <span>{saveState}</span>
                    <strong>{selectedTemplate?.name || "Custom Template"}</strong>
                </div>

                <button type="button" className="builderPreviewBtn" onClick={saveAndPreview}>
                    <Eye size={18} aria-hidden="true" />
                    <span>Preview</span>
                </button>
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
                        updateTickFile={updateTickFile}
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
                    updateTickFile={updateTickFile}
                />
            </section>

            <div className="builderBottomBar">
                <button type="button" onClick={() => saveInvitation({ createIfNeeded: true })}>
                    <Save size={17} aria-hidden="true" />
                    Save
                </button>
                <button type="button" onClick={saveAndPreview}>
                    <Eye size={17} aria-hidden="true" />
                    <span>Preview</span>
                </button>
                <button type="button" onClick={saveAndOpenPublish}>
                    <Rocket size={17} aria-hidden="true" />
                    Publish
                </button>
            </div>

            <LeaveModal
                isOpen={leaveModalOpen}
                isSaving={saveState === "Saving..."}
                onSave={async () => {
                    const savedInvitation = await saveInvitation({ createIfNeeded: true });
                    if (savedInvitation) router.push("/templates");
                }}
                onDiscard={handleDiscard}
                onCancel={() => setLeaveModalOpen(false)}
            />

            <PublishModal
                invitation={invitation}
                isOpen={isPublishModalOpen}
                onClose={() => setIsPublishModalOpen(false)}
                onPublishSuccess={(updatedInvitation) => {
                    setInvitation((prev) => ({
                        ...prev,
                        status: updatedInvitation.status,
                        publishedAt: updatedInvitation.published_at || null,
                        slug: updatedInvitation.slug,
                        updatedAt: new Date().toISOString(),
                    }));
                    setSaveState(updatedInvitation.status === "published" ? "Published" : "Saved");
                    if (updatedInvitation.status === "published") {
                        router.push("/profile");
                    }
                }}
            />
        </main>
    );
}

function LeaveModal({
    isOpen,
    isSaving,
    onSave,
    onDiscard,
    onCancel,
}: {
    isOpen: boolean;
    isSaving: boolean;
    onSave: () => Promise<void>;
    onDiscard: () => void;
    onCancel: () => void;
}) {
    const [saving, setSaving] = useState(false);

    if (!isOpen) return null;

    async function handleSave() {
        setSaving(true);
        await onSave();
        setSaving(false);
    }

    return (
        <div className="leaveModalScrim" onClick={onCancel}>
            <div
                className="leaveModalCard"
                role="dialog"
                aria-modal="true"
                aria-label="Leave builder"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="leaveModalIcon">📋</div>
                <h3>Save before leaving?</h3>
                <p>
                    Your invitation has unsaved changes. Would you like to save
                    your draft before going back?
                </p>
                <div className="leaveModalActions">
                    <button
                        type="button"
                        className="leaveModalSave"
                        onClick={handleSave}
                        disabled={saving || isSaving}
                    >
                        {saving ? "Saving…" : "Save Draft"}
                    </button>
                    <button
                        type="button"
                        className="leaveModalDiscard"
                        onClick={onDiscard}
                        disabled={saving}
                    >
                        Discard
                    </button>
                    <button
                        type="button"
                        className="leaveModalCancel"
                        onClick={onCancel}
                        disabled={saving}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
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
    updateTickFile,
}: {
    activeTab: EditorTab;
    invitation: ReturnType<typeof createDefaultInvitation>;
    updateField: (key: string, value: string) => void;
    updateTheme: (key: string, value: any) => void;
    updateMusicFile: (file: File | null) => void;
    updateTickFile: (file: File | null) => void;
}) {
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
                    <input type="date" value={invitation.eventDate} onChange={(e) => updateField("eventDate", e.target.value)} />
                </label>

                <label>
                    <span>Time</span>
                    <input value={invitation.eventTime} onChange={(e) => updateField("eventTime", e.target.value)} maxLength={35} />
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
                    <input value={invitation.phone || ""} onChange={(e) => updateField("phone", e.target.value)} maxLength={20} />
                </label>

                <label>
                    <span>Map Link</span>
                    <input value={invitation.mapLink} onChange={(e) => updateField("mapLink", e.target.value)} maxLength={250} />
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
                    This sound plays in the background automatically. It's set by the template and cannot be changed.
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
