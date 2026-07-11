"use client";

import { Suspense, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
    ChevronLeft,
    Eye,
    PencilLine,
    Rocket,
    Save,
    Smartphone,
    X,
} from "lucide-react";
import AuthRequiredModal from "@/components/AuthRequiredModal";
import { createDefaultInvitation } from "@/lib/defaultInvitation";
import { templates } from "@/data/templates";
import PastelFloralWedding from "@/components/templates/PastelFloralWedding";

type EditorTab = "content" | "event" | "contact" | "theme";
type PreviewScreen = "invite" | "thanks";

const editorTabs: { id: EditorTab; label: string }[] = [
    { id: "content", label: "Content" },
    { id: "event", label: "Event" },
    { id: "contact", label: "Contact" },
    { id: "theme", label: "Theme" },
];

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
    const [isPublishing, startPublishing] = useTransition();
    const previewViewportRef = useRef<HTMLDivElement>(null);
    const lastSavedPayload = useRef("");
    const hasLoadedDraft = useRef(false);
    const currentBuilderPath = `/builder${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;

    const selectedTemplate = useMemo(
        () => templates.find((item) => item.id === invitation.templateId),
        [invitation.templateId]
    );

    function updateField(key: string, value: string) {
        setInvitation((prev) => ({
            ...prev,
            [key]: value,
            updatedAt: new Date().toISOString(),
        }));
    }

    function updateTheme(key: string, value: string) {
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

        setSaveState("Uploading music...");
        const formData = new FormData();
        formData.set("invitationId", invitation.id);
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
    }, [activeTab, previewScreen]);

    useEffect(() => {
        if (hasLoadedDraft.current) return;
        hasLoadedDraft.current = true;

        const existingId = searchParams.get("id");
        const templateKey = searchParams.get("template") || "pastel-floral-wedding";

        async function loadOrCreateDraft() {
            if (existingId) {
                const response = await fetch(`/api/invitations/${existingId}`);
                if (response.ok) {
                    setInvitation(await response.json());
                    setSaveState("Saved");
                    return;
                }
            }

            const response = await fetch("/api/invitations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ templateKey }),
            });
            const draft = await response.json();

            if (!response.ok) {
                setSaveState(draft.error || "Could not create draft");
                return;
            }

            setInvitation((prev) => ({
                ...prev,
                id: draft.id,
                slug: draft.slug,
                updatedAt: new Date().toISOString(),
            }));
            setSaveState("Draft created");
            router.replace(`/builder?id=${draft.id}`);
        }

        void loadOrCreateDraft();
    }, [router, searchParams]);

    useEffect(() => {
        if (!hasLoadedDraft.current || !invitation.id.includes("-")) return;

        const payload = JSON.stringify({
            slug: invitation.slug,
            category: invitation.category,
            title: invitation.title,
            primaryName: invitation.primaryName,
            secondaryName: invitation.secondaryName || null,
            eventDate: invitation.eventDate,
            eventTime: invitation.eventTime,
            venueName: invitation.venueName,
            venueAddress: invitation.venueAddress,
            mapLink: invitation.mapLink,
            phone: invitation.phone || null,
            whatsapp: invitation.whatsapp || null,
            message: invitation.message,
            musicUrl: invitation.musicUrl || null,
            coverImageUrl: invitation.coverImageUrl || null,
            galleryUrls: invitation.galleryUrls || [],
            theme: invitation.theme,
            sections: invitation.sections || {},
        });

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
    }, [invitation]);

    function publishInvitation() {
        startPublishing(async () => {
            setSaveState("Publishing...");
            const response = await fetch(`/api/invitations/${invitation.id}/publish`, {
                method: "POST",
            });
            const result = await response.json().catch(() => ({}));

            if (!response.ok) {
                setSaveState(result.error || "Publish failed");
                return;
            }

            setInvitation((prev) => ({
                ...prev,
                status: "published",
                publishedAt: result.published_at,
                updatedAt: new Date().toISOString(),
            }));
            setSaveState("Published");
        });
    }

    return (
        <main className="builderShell">
            <AuthRequiredModal next={currentBuilderPath} />

            <header className="builderTopbar">
                <Link href="/templates" className="builderBack">
                    <ChevronLeft size={20} aria-hidden="true" />
                    <span>Templates</span>
                </Link>

                <div className="builderTitle">
                    <span>{saveState}</span>
                    <strong>{selectedTemplate?.name || "Custom Template"}</strong>
                </div>

                <Link href={`/invite/${invitation.slug}`} className="builderPreviewBtn">
                    <Eye size={18} aria-hidden="true" />
                    <span>Preview</span>
                </Link>
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
                                    <PastelFloralWedding
                                        key={previewScreen}
                                        invitation={invitation}
                                        accepted={previewScreen === "thanks"}
                                    />
                                </div>
                            </div>
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
                <button type="button" onClick={() => setSaveState("Saved")}>
                    <Save size={17} aria-hidden="true" />
                    Save
                </button>
                <Link href={`/invite/${invitation.slug}`}>
                    <Eye size={17} aria-hidden="true" />
                    Preview
                </Link>
                <button type="button" onClick={publishInvitation} disabled={isPublishing}>
                    <Rocket size={17} aria-hidden="true" />
                    {isPublishing ? "..." : "Publish"}
                </button>
            </div>
        </main>
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
    updateTheme: (key: string, value: string) => void;
    updateMusicFile: (file: File | null) => void;
}) {
    if (activeTab === "content") {
        return (
            <div className="editorForm">
                <label>
                    <span>Title</span>
                    <input value={invitation.title} onChange={(e) => updateField("title", e.target.value)} />
                </label>

                <label>
                    <span>Primary Name</span>
                    <input value={invitation.primaryName} onChange={(e) => updateField("primaryName", e.target.value)} />
                </label>

                <label>
                    <span>Secondary Name</span>
                    <input value={invitation.secondaryName || ""} onChange={(e) => updateField("secondaryName", e.target.value)} />
                </label>

                <label>
                    <span>Message</span>
                    <textarea value={invitation.message} onChange={(e) => updateField("message", e.target.value)} />
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
                    <input value={invitation.eventTime} onChange={(e) => updateField("eventTime", e.target.value)} />
                </label>

                <label>
                    <span>Venue Name</span>
                    <input value={invitation.venueName} onChange={(e) => updateField("venueName", e.target.value)} />
                </label>

                <label>
                    <span>Venue Address</span>
                    <textarea value={invitation.venueAddress} onChange={(e) => updateField("venueAddress", e.target.value)} />
                </label>
            </div>
        );
    }

    if (activeTab === "contact") {
        return (
            <div className="editorForm">
                <label>
                    <span>Phone / WhatsApp</span>
                    <input value={invitation.phone || ""} onChange={(e) => updateField("phone", e.target.value)} />
                </label>

                <label>
                    <span>Map Link</span>
                    <input value={invitation.mapLink} onChange={(e) => updateField("mapLink", e.target.value)} />
                </label>

                <label>
                    <span>Celebration Song</span>
                    <input
                        type="file"
                        accept="audio/*"
                        onChange={(e) => updateMusicFile(e.target.files?.[0] ?? null)}
                    />
                </label>
            </div>
        );
    }

    return (
        <div className="editorForm">
            <label>
                <span>Primary Color</span>
                <input type="color" value={invitation.theme.primaryColor} onChange={(e) => updateTheme("primaryColor", e.target.value)} />
            </label>

            <label>
                <span>Background Color</span>
                <input type="color" value={invitation.theme.backgroundColor} onChange={(e) => updateTheme("backgroundColor", e.target.value)} />
            </label>

            <label>
                <span>Text Color</span>
                <input type="color" value={invitation.theme.textColor} onChange={(e) => updateTheme("textColor", e.target.value)} />
            </label>
        </div>
    );
}
