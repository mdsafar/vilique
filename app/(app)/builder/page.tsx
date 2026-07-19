"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    AlertTriangle,
    ArrowLeft,
    CalendarDays,
    Check,
    ChevronLeft,
    Clock3,
    Copy,
    Eye,
    ExternalLink,
    FileText,
    Loader2,
    Mail,
    Monitor,
    Pause,
    PencilLine,
    Play,
    Rocket,
    Save,
    Smartphone,
    Users,
    Volume2,
    X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import AuthRequiredModal from "@/components/AuthRequiredModal";
import ProtectedRoute from "@/components/ProtectedRoute";
import PublishModal from "@/components/PublishModal";
import { useToast } from "@/components/Toast";
import { useSWRConfig } from "swr";
import { mutateInvitationState } from "@/lib/invitationCache";
import { createDefaultInvitation } from "@/lib/defaultInvitation";
import { normalizeInvitationDateValue, parseInvitationDateParts } from "@/lib/invitationDate";
import { getPublicInvitationUrl } from "@/lib/config/site";
import { createDemoCountdownTargetDate } from "@/lib/demoCountdown";
import { templates } from "@/data/templates";
import TemplateRenderer from "@/components/TemplateRenderer";
import { FloatingFlowers } from "@/components/templates/PastelFloralWedding";
import type { InvitationData } from "@/types/invitation";
import {
    validateInvitationFields,
    type BuilderValidationErrors,
    type BuilderValidationFieldKey,
} from "@/features/invitations/validation";

type EditorTab = "content" | "event" | "contact" | "sound";
type PreviewScreen = "invite" | "thanks";
type PublishSuccessDetails = {
    slug: string;
    publishedAt?: string | null;
};

const requiredFieldTabs: Record<BuilderValidationFieldKey, EditorTab> = {
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


function formatSaveError(error: unknown): string {
    if (!error) return "Save failed";
    if (typeof error === "string") return error;
    if (typeof error === "object") {
        const result = error as {
            fieldErrors?: Record<string, unknown>;
            formErrors?: unknown;
            message?: unknown;
        };

        if (result.fieldErrors && typeof result.fieldErrors === "object") {
            const keys = Object.keys(result.fieldErrors);
            if (keys.length > 0) {
                const firstField = keys[0];
                const fieldMsgs = result.fieldErrors[firstField];
                if (Array.isArray(fieldMsgs) && fieldMsgs.length > 0) {
                    return `${firstField}: ${fieldMsgs[0]}`;
                }
            }
        }
        if (Array.isArray(result.formErrors) && result.formErrors.length > 0) {
            return String(result.formErrors[0]);
        }
        if (typeof result.message === "string") {
            return result.message;
        }
    }
    return "Save failed";
}

function parseServerValidationErrors(fields: unknown): BuilderValidationErrors {
    if (!fields || typeof fields !== "object") {
        return { title: "Please fix the highlighted fields before continuing." };
    }

    const errors: BuilderValidationErrors = {};
    Object.entries(fields as Record<string, unknown>).forEach(([key, value]) => {
        if (typeof value === "string" && value.trim()) {
            errors[key as BuilderValidationFieldKey] = value;
        } else {
            errors[key as BuilderValidationFieldKey] = "Required field missing.";
        }
    });

    return Object.keys(errors).length > 0 ? errors : { title: "Please fix the highlighted fields before continuing." };
}


const editorTabs: { id: EditorTab; label: string }[] = [
    { id: "content", label: "Content" },
    { id: "event", label: "Event" },
    { id: "contact", label: "Contact" },
    { id: "sound", label: "Sound" },
];
const builderRailItems: {
    id: EditorTab;
    label: string;
    icon: typeof FileText;
}[] = [
        { id: "content", label: "Content", icon: FileText },
        { id: "event", label: "Event", icon: Mail },
        { id: "contact", label: "Contact", icon: Users },
        { id: "sound", label: "Sound", icon: Volume2 },
    ];
const weddingTemplateTitleOptions = ["Wedding Invitation", "Reception"] as const;
const weddingTemplateDefaultTitle = weddingTemplateTitleOptions[0];
const builderLocalPreviewKey = "vilique-builder-local-preview";

let activeSoundPreviewAudio: HTMLAudioElement | null = null;
let activeSoundPreviewStop: (() => void) | null = null;

function stopActiveSoundPreview() {
    activeSoundPreviewStop?.();
    activeSoundPreviewAudio = null;
    activeSoundPreviewStop = null;
    dispatchSoundPreviewState(false);
}

function dispatchSoundPreviewState(isPlaying: boolean) {
    window.dispatchEvent(new Event(isPlaying ? "vilique:sound-preview-start" : "vilique:sound-preview-stop"));
}

function readLocalPreviewDraft(templateKey: string): { invitation: InvitationData } | null {
    if (typeof window === "undefined") return null;

    try {
        const stored = sessionStorage.getItem(builderLocalPreviewKey);
        if (!stored) return null;
        const parsed = JSON.parse(stored) as { invitation?: InvitationData };
        if (!parsed.invitation || parsed.invitation.templateId !== templateKey) return null;
        return { invitation: parsed.invitation };
    } catch {
        sessionStorage.removeItem(builderLocalPreviewKey);
        return null;
    }
}

export default function BuilderPage() {
    return (
        <Suspense fallback={<main className="builderShell" />}>
            <BuilderProtectedContent />
        </Suspense>
    );
}

function BuilderProtectedContent() {
    const searchParams = useSearchParams();
    const currentBuilderPath = `/builder${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;

    return (
        <ProtectedRoute next={currentBuilderPath} className="builderShell">
            <BuilderContent />
        </ProtectedRoute>
    );
}

function BuilderContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { showToast } = useToast();
    const [invitation, setInvitation] = useState(createDefaultInvitation());
    const [authStatus, setAuthStatus] = useState<"authed" | "guest">("authed");
    const [isLoadingInvitation, setIsLoadingInvitation] = useState(true);
    const [activeTab, setActiveTab] = useState<EditorTab>("content");
    const [previewScreen, setPreviewScreen] = useState<PreviewScreen>("invite");
    const [previewDeviceMode, setPreviewDeviceMode] = useState<"mobile" | "desktop">("mobile");
    const [editorCollapsed, setEditorCollapsed] = useState(false);
    const [demoCountdownTargetDate, setDemoCountdownTargetDate] = useState<Date | null>(createDemoCountdownTargetDate);
    const [mobileEditorOpen, setMobileEditorOpen] = useState(() => (
        typeof window !== "undefined" ? window.matchMedia("(max-width: 899px)").matches : false
    ));
    const [saveState, setSaveState] = useState("Creating draft...");
    const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
    const [leaveModalOpen, setLeaveModalOpen] = useState(false);
    const [isPreviewing, setIsPreviewing] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [isUploadingMusic, setIsUploadingMusic] = useState(false);
    const [validationErrors, setValidationErrors] = useState<BuilderValidationErrors>({});
    const [publishSuccessDetails, setPublishSuccessDetails] = useState<PublishSuccessDetails | null>(null);
    const [previewScrolledToBottom, setPreviewScrolledToBottom] = useState(false);
    const previewViewportRef = useRef<HTMLDivElement>(null);
    const [initialSavedPayload, setInitialSavedPayload] = useState("");
    const lastSavedPayloadRef = useRef("");
    const lastSaveErrorToast = useRef("");
    const hasLoadedDraft = useRef(false);
    const createDraftPromise = useRef<Promise<InvitationData> | null>(null);
    const isNewDraft = useRef(true);
    const initialInvitation = useRef<InvitationData | null>(null);
    const autosaveControllerRef = useRef<AbortController | null>(null);
    const isIntentionalNavigationRef = useRef(false);
    const { mutate: globalMutate } = useSWRConfig();

    const existingId = searchParams.get("id");
    const templateKey = searchParams.get("template") || "pastel-floral-wedding";
    const openedFromProfile = searchParams.get("from") === "profile";
    const openedFromInvitations = searchParams.get("from") === "invitations";
    const openedFromTemplateDetails = searchParams.get("from") === "template-details";

    const openedFromExistingInvitation = useMemo(() => {
        const isSessionNewDraft = !openedFromProfile && !openedFromInvitations && existingId && typeof window !== "undefined"
            ? sessionStorage.getItem(`vilique-new-draft-${existingId}`) === "true"
            : !existingId;
        return openedFromProfile || openedFromInvitations || (!!existingId && !isSessionNewDraft);
    }, [existingId, openedFromInvitations, openedFromProfile]);

    const builderBackLabel = useMemo(() => {
        if (openedFromExistingInvitation) return "Invitations";
        if (existingId && typeof window !== "undefined") {
            const stored = sessionStorage.getItem(`vilique-builder-back-label-${existingId}`);
            if (stored) return stored;
        }
        return "Templates";
    }, [existingId, openedFromExistingInvitation]);

    const builderBackTarget = useMemo(() => {
        const returnToParam = searchParams.get("returnTo");
        if (returnToParam) return returnToParam;
        if (existingId && typeof window !== "undefined") {
            const stored = sessionStorage.getItem(`vilique-builder-back-target-${existingId}`);
            if (stored) return stored;
        }
        if (openedFromExistingInvitation) {
            return invitation.status === "published" ? "/invitations?status=upcoming" : "/invitations";
        }
        if (openedFromTemplateDetails) return `/templates/${templateKey}`;
        return "/";
    }, [existingId, invitation.status, openedFromExistingInvitation, openedFromTemplateDetails, searchParams, templateKey]);

    const updateLastSavedPayload = useCallback((payload: string) => {
        lastSavedPayloadRef.current = payload;
    }, []);

    const invalidateInvitationsCache = useCallback((updatedInvitation?: InvitationData, previousInvitation?: InvitationData | null) => {
        mutateInvitationState(globalMutate, updatedInvitation, previousInvitation);
    }, [globalMutate]);
    const currentBuilderPath = `/builder${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
    const isPersistedDraft = invitation.id !== "default-draft-placeholder-id";
    const isEditingPublished = openedFromExistingInvitation && invitation.status === "published";

    useEffect(() => {
        if (!mobileEditorOpen) return;
        if (!window.matchMedia("(max-width: 899px)").matches) return;

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
    const displayedValidationErrors = useMemo(() => validationErrors, [validationErrors]);

    const buildSavePayload = useCallback((source: InvitationData = invitation) => {
        const normalizedEventDate = normalizeInvitationDateValue(source.eventDate);
        const safeEventDate = normalizedEventDate || toDateInputValue(new Date());

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
            secondaryPhone: source.secondaryPhone || null,
            whatsapp: source.whatsapp || null,
            message: source.message,
            musicUrl: source.musicUrl && source.musicUrl !== source.defaultMusicUrl ? source.musicUrl : null,
            coverImageUrl: source.coverImageUrl || null,
            galleryUrls: source.galleryUrls || [],
            theme: source.theme,
            sections: source.sections || {},
        });
    }, [invitation]);

    // Track whether the current payload differs from initial loaded payload or last saved payload
    const hasUnsavedChanges = !isLoadingInvitation && initialSavedPayload !== "" && buildSavePayload(invitation) !== initialSavedPayload;

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
                    secondaryPhone: invitation.secondaryPhone,
                    whatsapp: invitation.whatsapp,
                    message: invitation.message,
                    musicUrl: invitation.musicUrl,
                    theme: invitation.theme,
                    updatedAt: draft.updatedAt || new Date().toISOString(),
                };

                if (typeof window !== "undefined") {
                    sessionStorage.removeItem(builderLocalPreviewKey);
                    sessionStorage.setItem(`vilique-new-draft-${draft.id}`, "true");
                    sessionStorage.setItem(`vilique-builder-back-target-${draft.id}`, builderBackTarget);
                    sessionStorage.setItem(`vilique-builder-back-label-${draft.id}`, builderBackLabel);
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

    const handleValidationFailure = useCallback((errors: BuilderValidationErrors) => {
        const firstField = Object.keys(errors)[0] as BuilderValidationFieldKey | undefined;
        if (firstField) {
            const tab = requiredFieldTabs[firstField];
            if (tab) setActiveTab(tab);
            setMobileEditorOpen(true);
            setSaveState("Fix required fields");
            showToast("Please fix the highlighted fields before continuing.", "error");

            window.setTimeout(() => {
                const element = document.querySelector(`[data-field-key="${firstField}"]`) as HTMLElement | null;
                if (element) {
                    element.scrollIntoView({ behavior: "smooth", block: "center" });
                    element.focus();
                }
            }, 120);
        }
    }, [showToast]);

    const showSaveFailure = useCallback((message: string) => {
        setSaveState(message);
        if (lastSaveErrorToast.current !== message) {
            lastSaveErrorToast.current = message;
            showToast(message, "error");
        }
    }, [showToast]);

    async function saveInvitation(options: { createIfNeeded?: boolean; isExplicitUserSave?: boolean } = {}) {
        // Cancel any in-flight autosave to avoid race conditions with explicit saves
        autosaveControllerRef.current?.abort();
        autosaveControllerRef.current = null;

        const errors = validateInvitationFields(invitation);
        if (Object.keys(errors).length > 0) {
            setValidationErrors(errors);
            handleValidationFailure(errors);
            return null;
        }

        const source = options.createIfNeeded ? await ensureDraftExists() : invitation;
        if (source.id === "default-draft-placeholder-id") return null;

        const payload = buildSavePayload(source);
        if (payload === lastSavedPayloadRef.current) {
            setSaveState("✓ Saved");
            if (options.isExplicitUserSave) {
                setInitialSavedPayload(payload);
                isNewDraft.current = false;
                if (typeof window !== "undefined") {
                    sessionStorage.removeItem(builderLocalPreviewKey);
                    sessionStorage.removeItem(`vilique-new-draft-${source.id}`);
                    sessionStorage.removeItem(`vilique-builder-back-target-${source.id}`);
                    sessionStorage.removeItem(`vilique-builder-back-label-${source.id}`);
                }
            }
            invalidateInvitationsCache(source, initialInvitation.current);
            initialInvitation.current = source;
            return source;
        }

        setSaveState("Saving…");
        const response = await fetch(`/api/invitations/${source.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: payload,
        });

        if (response.ok) {
            const previousInvitation = initialInvitation.current;
            updateLastSavedPayload(payload);
            lastSaveErrorToast.current = "";
            setValidationErrors({});
            setSaveState("✓ Saved");
            if (options.isExplicitUserSave) {
                setInitialSavedPayload(payload);
                isNewDraft.current = false;
                if (typeof window !== "undefined") {
                    sessionStorage.removeItem(builderLocalPreviewKey);
                    sessionStorage.removeItem(`vilique-new-draft-${source.id}`);
                    sessionStorage.removeItem(`vilique-builder-back-target-${source.id}`);
                    sessionStorage.removeItem(`vilique-builder-back-label-${source.id}`);
                }
            }
            invalidateInvitationsCache(source, previousInvitation);
            initialInvitation.current = source;
            return source;
        }

        const result = await response.json().catch(() => ({}));
        if (result.code === "REQUIRED_FIELDS_MISSING") {
            const serverErrors = parseServerValidationErrors(result.fields);
            setValidationErrors(serverErrors);
            handleValidationFailure(serverErrors);
            return null;
        }
        if (response.status === 409 && result.code === "INVITATION_COMPLETED_LOCKED") {
            const message = result.error || "This invitation is completed and can no longer be edited.";
            showSaveFailure(message);
            window.setTimeout(navigateBackToList, 450);
            return null;
        }
        if (response.status === 409 && (result.code === "EVENT_IDENTITY_CHANGED" || result.code === "NEW_EVENT_DETECTED" || result.code === "PROTECTED_EVENT_IDENTITY")) {
            const message = result.error || "This invitation is protected after publishing.";
            showSaveFailure(message);
            return null;
        }
        showSaveFailure(formatSaveError(result.error));
        return null;
    }

    async function handleUpdateInvitation() {
        setIsPublishing(true);
        const errors = validateInvitationFields(invitation);
        if (Object.keys(errors).length > 0) {
            setValidationErrors(errors);
            handleValidationFailure(errors);
            setIsPublishing(false);
            return;
        }
        const saved = await saveInvitation({ createIfNeeded: true, isExplicitUserSave: true });
        if (!saved) {
            setIsPublishing(false);
            return;
        }
        setSaveState(invitation.status === "published" ? "✓ Updated" : "✓ Saved");
        showToast("Invitation updated successfully", "success");
        window.setTimeout(() => navigateBackToList(), 450);
    }

    const navigateBackToList = useCallback(() => {
        isIntentionalNavigationRef.current = true;
        if (!openedFromExistingInvitation && invitation.id === "default-draft-placeholder-id") {
            router.replace(builderBackTarget);
        } else if (!openedFromExistingInvitation && invitation.status !== "published") {
            router.replace("/invitations?status=draft");
        } else {
            router.replace(builderBackTarget);
        }
    }, [builderBackTarget, invitation.id, invitation.status, openedFromExistingInvitation, router]);

    const handleBackClick = useCallback(() => {
        if (hasUnsavedChanges) {
            setLeaveModalOpen(true);
        } else {
            navigateBackToList();
        }
    }, [hasUnsavedChanges, navigateBackToList]);

    function saveAndPreview() {
        setIsPreviewing(true);
        // Always write live in-memory state to sessionStorage so preview reflects
        // exactly what the user sees in the builder — no implicit save to DB.
        if (typeof window !== "undefined") {
            sessionStorage.setItem(builderLocalPreviewKey, JSON.stringify({
                invitation,
                backLabel: builderBackLabel,
                backTarget: builderBackTarget,
            }));
        }
        if (invitation.id !== "default-draft-placeholder-id") {
            router.push(`/builder/preview?id=${invitation.id}&local=1`);
        } else {
            router.push(`/builder/preview?local=1&template=${encodeURIComponent(invitation.templateId)}`);
        }
        // Navigation is underway; component will unmount. No need to reset isPreviewing.
    }

    async function saveAndOpenPublish() {
        setIsPublishing(true);
        const errors = validateInvitationFields(invitation);
        if (Object.keys(errors).length > 0) {
            setValidationErrors(errors);
            handleValidationFailure(errors);
            setIsPublishing(false);
            return;
        }
        // Don't mark as explicit user save yet — user can still cancel out of the publish modal
        const savedInvitation = await saveInvitation({ createIfNeeded: true });
        setIsPublishing(false);
        if (savedInvitation) {
            setIsPublishModalOpen(true);
        }
    }

    async function handleDiscard() {
        autosaveControllerRef.current?.abort();
        autosaveControllerRef.current = null;

        const isPersisted = invitation.id !== "default-draft-placeholder-id";
        if (isPersisted) {
            if (isNewDraft.current) {
                // Delete the new draft since it was only created in this session (e.g. from Preview/file upload)
                await fetch(`/api/invitations/${invitation.id}`, {
                    method: "DELETE",
                }).catch(() => { });
                isIntentionalNavigationRef.current = true;
                if (typeof window !== "undefined") {
                    sessionStorage.removeItem(builderLocalPreviewKey);
                    sessionStorage.removeItem(`vilique-new-draft-${invitation.id}`);
                    sessionStorage.removeItem(`vilique-builder-back-target-${invitation.id}`);
                    sessionStorage.removeItem(`vilique-builder-back-label-${invitation.id}`);
                }
                mutateInvitationState(globalMutate, undefined, undefined, invitation, true);
                router.replace(builderBackTarget);
                return;
            } else if (initialInvitation.current) {
                // Revert existing draft to pristine state when loaded
                const revertedInvitation: InvitationData = {
                    ...initialInvitation.current,
                    updatedAt: new Date().toISOString(),
                };
                await fetch(`/api/invitations/${invitation.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: buildSavePayload(revertedInvitation),
                }).catch(() => { });
                isIntentionalNavigationRef.current = true;
                if (typeof window !== "undefined") {
                    sessionStorage.removeItem(builderLocalPreviewKey);
                }
                mutateInvitationState(globalMutate, revertedInvitation, invitation, undefined, true);
                router.replace(builderBackTarget);
                return;
            }
        }
        isIntentionalNavigationRef.current = true;
        if (typeof window !== "undefined") {
            sessionStorage.removeItem(builderLocalPreviewKey);
        }
        router.replace(builderBackTarget);
    }

    function updateField(key: string, value: string) {
        if (key === "eventDate" || key === "eventTime") {
            setDemoCountdownTargetDate(null);
        }
        const nextInvitation = { ...invitation, [key]: value };
        const nextErrors = validateInvitationFields(nextInvitation);
        setValidationErrors((prev) => {
            const next = { ...prev };
            if (nextErrors[key as BuilderValidationFieldKey]) {
                next[key as BuilderValidationFieldKey] = nextErrors[key as BuilderValidationFieldKey];
            } else {
                delete next[key as BuilderValidationFieldKey];
            }
            return next;
        });
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
        setIsUploadingMusic(true);
        setSaveState("Uploading music...");
        try {
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
            setSaveState("✓ Saved");
        } finally {
            setIsUploadingMusic(false);
        }
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
            const isScrollable = viewport.scrollHeight > viewport.clientHeight + 4;
            const isBottom = !isScrollable || (viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 24);
            setPreviewScrolledToBottom(isBottom);
        }

        viewport.addEventListener("scroll", handleScroll, { passive: true });
        handleScroll();

        const observer = new ResizeObserver(() => {
            handleScroll();
        });
        observer.observe(viewport);
        if (viewport.firstElementChild) {
            observer.observe(viewport.firstElementChild);
        }

        return () => {
            viewport.removeEventListener("scroll", handleScroll);
            observer.disconnect();
        };
    }, [invitation, previewScreen, activeTab]);

    useEffect(() => {
        if (hasLoadedDraft.current) return;
        hasLoadedDraft.current = true;

        const isSessionNewDraft = !openedFromProfile && !openedFromInvitations && existingId && typeof window !== "undefined"
            ? sessionStorage.getItem(`vilique-new-draft-${existingId}`) === "true"
            : !existingId;
        isNewDraft.current = !!isSessionNewDraft;

        async function loadDraft() {
            if (existingId) {
                const response = await fetch(`/api/invitations/${existingId}`);
                if (response.ok) {
                    const draft = normalizeInvitationDate(await response.json());
                    setDemoCountdownTargetDate(null);
                    setInvitation(draft);
                    initialInvitation.current = draft;
                    const draftPayload = buildSavePayload(draft);
                    setInitialSavedPayload(draftPayload);
                    updateLastSavedPayload(draftPayload);
                    setSaveState(draft.status === "published" ? "✓ Published" : "✓ Saved");
                    setIsLoadingInvitation(false);
                    return;
                }
                const result = await response.json().catch(() => ({}));
                if (response.status === 401) {
                    setAuthStatus("guest");
                    setIsLoadingInvitation(false);
                    return;
                }
                if (response.status === 409 && result.code === "INVITATION_COMPLETED_LOCKED") {
                    showToast(result.error || "This invitation is completed and can no longer be edited.", "error");
                    router.replace("/invitations?reset=1");
                    return;
                }
            }

            const defaultInv = {
                ...createDefaultInvitation(),
                templateId: templateKey,
                updatedAt: new Date().toISOString(),
            };
            const localPreviewDraft = readLocalPreviewDraft(templateKey);
            if (localPreviewDraft) {
                const restoredDraft = normalizeInvitationDate(localPreviewDraft.invitation);
                setInvitation(restoredDraft);
                initialInvitation.current = restoredDraft;
                const draftPayload = buildSavePayload(restoredDraft);
                setInitialSavedPayload(draftPayload);
                updateLastSavedPayload(draftPayload);
                setSaveState("Not saved");
                setIsLoadingInvitation(false);
                return;
            }

            const normalizedDefaultInv = normalizeInvitationDate(defaultInv);
            setInvitation(normalizedDefaultInv);
            initialInvitation.current = normalizedDefaultInv;
            const draftPayload = buildSavePayload(normalizedDefaultInv);
            setInitialSavedPayload(draftPayload);
            updateLastSavedPayload(draftPayload);
            setSaveState("Not saved");
            setIsLoadingInvitation(false);
        }

        void loadDraft();
    }, [buildSavePayload, existingId, openedFromInvitations, openedFromProfile, router, showToast, templateKey, updateLastSavedPayload]);

    useEffect(() => {
        if (!hasLoadedDraft.current || !isPersistedDraft) return;

        const payload = buildSavePayload(invitation);

        if (payload === lastSavedPayloadRef.current) return;

        setSaveState("Saving…");

        // Each render cycle gets its own AbortController so the previous in-flight
        // request is cancelled when a new edit arrives, preventing last-writer-wins races.
        const controller = new AbortController();
        autosaveControllerRef.current = controller;

        const timeout = window.setTimeout(async () => {
            if (controller.signal.aborted) return;

            const errors = validateInvitationFields(invitation);
            if (Object.keys(errors).length > 0) {
                setValidationErrors(errors);
                setSaveState("Fix required fields");
                return;
            }

            // An explicit save (Publish / Save Draft) may have already persisted this payload
            if (payload === lastSavedPayloadRef.current) {
                setSaveState("✓ Saved");
                return;
            }


            try {
                const response = await fetch(`/api/invitations/${invitation.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: payload,
                    signal: controller.signal,
                });

                if (controller.signal.aborted) return;

                if (response.ok) {
                    updateLastSavedPayload(payload);
                    lastSaveErrorToast.current = "";
                    setValidationErrors({});
                    setSaveState("✓ Saved");
                    invalidateInvitationsCache(invitation, initialInvitation.current);
                    return;
                }

                const result = await response.json().catch(() => ({}));
                if (controller.signal.aborted) return;
                if (result.code === "REQUIRED_FIELDS_MISSING") {
                    setValidationErrors(parseServerValidationErrors(result.fields));
                    setSaveState("Fix required fields");
                } else if (response.status === 409 && (result.code === "MAJOR_CHANGE_DETECTED" || result.code === "EVENT_IDENTITY_CHANGED" || result.code === "NEW_EVENT_DETECTED" || result.code === "PROTECTED_EVENT_IDENTITY")) {
                    const message = result.error || "This invitation is protected after publishing.";
                    showSaveFailure(message);
                } else if (response.status === 409 && result.code === "INVITATION_COMPLETED_LOCKED") {
                    const message = result.error || "This invitation is completed and can no longer be edited.";
                    showSaveFailure(message);
                    window.setTimeout(() => router.replace(builderBackTarget), 450);
                } else {
                    showSaveFailure(formatSaveError(result.error));
                }
            } catch (err) {
                // AbortError is expected whenever cleanup cancels an in-flight request
                // (e.g. rapid edits trigger a new autosave cycle). Silence it.
                if (err instanceof Error && err.name === "AbortError") return;
                throw err;
            } finally {
                if (autosaveControllerRef.current === controller) {
                    autosaveControllerRef.current = null;
                }
            }
        }, 650);

        return () => {
            controller.abort();
            window.clearTimeout(timeout);
        };
    }, [buildSavePayload, builderBackTarget, invalidateInvitationsCache, invitation, isPersistedDraft, router, showSaveFailure, updateLastSavedPayload]);


    // Warn the browser (refresh / tab-close) when there are unsaved changes
    useEffect(() => {
        if (!hasUnsavedChanges) return;

        function handleBeforeUnload(e: BeforeUnloadEvent) {
            e.preventDefault();
        }

        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [hasUnsavedChanges]);

    // Intercept browser Back / swipe-back / OS back gesture when there are unsaved changes
    useEffect(() => {
        if (!hasUnsavedChanges) return;

        function handlePopState() {
            if (isIntentionalNavigationRef.current) return;
            // Push the current entry back so the URL doesn't change
            window.history.pushState(null, "", window.location.href);
            setLeaveModalOpen(true);
        }

        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, [hasUnsavedChanges]);

    if (isLoadingInvitation) {
        return <BuilderLoadingState />;
    }

    if (authStatus === "guest") {
        return (
            <main className="builderShell">
                <AuthRequiredModal next={currentBuilderPath} forceOpen />
            </main>
        );
    }

    return (
        <main className="builderShell">
            <header className="builderTopbar analyticsHeader">
                <button
                    type="button"
                    className="builderBack analyticsBackBtn"
                    onClick={handleBackClick}
                >
                    <ArrowLeft size={16} aria-hidden="true" />
                    <span>{builderBackLabel}</span>
                </button>

                <div className="builderTitle analyticsHeaderText">
                    <h1>{selectedTemplate?.name || "Custom Template"}</h1>
                    <p>{saveState}</p>
                </div>

                <div className="builderHeaderActions">
                    <button
                        type="button"
                        className="builderPreviewAction"
                        onClick={saveAndPreview}
                        disabled={isPreviewing || isPublishing}
                    >
                        {isPreviewing ? <Loader2 size={17} className="spinner" /> : <Eye size={17} aria-hidden="true" />}
                        <span>Preview</span>
                    </button>
                    <button
                        type="button"
                        className="builderPublishAction"
                        onClick={isEditingPublished ? handleUpdateInvitation : saveAndOpenPublish}
                        disabled={isPreviewing || isPublishing}
                    >
                        {isPublishing ? <Loader2 size={17} className="spinner" /> : <Rocket size={17} aria-hidden="true" />}
                        <span>
                            {isPublishing
                                ? isEditingPublished ? "Updating..." : "Publishing..."
                                : isEditingPublished ? "Update" : "Publish"}
                        </span>
                    </button>
                </div>
            </header>

            <section className={`builderWorkspace${editorCollapsed ? " editorCollapsed" : ""}`}>
                <BuilderToolRail
                    activeTab={activeTab}
                    setActiveTab={(tab) => {
                        setActiveTab(tab);
                        setEditorCollapsed(false);
                    }}
                />

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
                        errors={displayedValidationErrors}
                        updateField={updateField}
                        updateTheme={updateTheme}
                        updateMusicFile={updateMusicFile}
                        isUploadingMusic={isUploadingMusic}
                    />
                </aside>

                <button
                    className="builderEditorCollapse"
                    type="button"
                    aria-label={editorCollapsed ? "Show editor" : "Hide editor"}
                    onClick={() => setEditorCollapsed((collapsed) => !collapsed)}
                >
                    <ChevronLeft size={18} aria-hidden="true" />
                </button>

                <section className="builderCanvas" aria-label="Invitation canvas">
                    <div className="previewColumn">
                        <div className="previewLabel">
                            <span>
                                <Smartphone size={15} aria-hidden="true" />
                                Live preview
                                <span className="liveDot" />
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
                            </div>
                        </div>

                        <div className={`previewDevice previewDevice--${previewDeviceMode}${!previewScrolledToBottom ? " hasScrollCue" : ""}`}>
                            <div className="previewFixedTemplateBg" aria-hidden="true">
                                <FloatingFlowers />
                            </div>
                            <div className="previewViewport" ref={previewViewportRef}>
                                <div className="previewScaleFrame">
                                    <TemplateRenderer
                                        invitation={invitation}
                                        accepted={previewScreen === "thanks"}
                                        demoCountdownTargetDate={demoCountdownTargetDate ?? undefined}
                                        onAccept={() => setPreviewScreen("thanks")}
                                        onDecline={() => setPreviewScreen("invite")}
                                        enableAudio
                                    />
                                </div>
                            </div>
                            <span className="previewScrollFade" aria-hidden="true" />
                            <span className="templatePreviewScrollCue" aria-hidden="true" />
                        </div>
                    </div>
                </section>

                <div className="builderCanvasControls" aria-label="Preview device">
                    <button
                        type="button"
                        className={previewDeviceMode === "mobile" ? "active" : ""}
                        aria-label="Mobile preview"
                        title="Mobile preview"
                        onClick={() => setPreviewDeviceMode("mobile")}
                    >
                        <Smartphone size={18} aria-hidden="true" />
                    </button>
                    <button
                        type="button"
                        className={previewDeviceMode === "desktop" ? "active" : ""}
                        aria-label="Desktop preview"
                        title="Desktop preview"
                        onClick={() => setPreviewDeviceMode("desktop")}
                    >
                        <Monitor size={18} aria-hidden="true" />
                    </button>
                </div>
            </section>

            <button
                className={`mobileEditorTrigger ${mobileEditorOpen ? "hidden" : ""}`}
                type="button"
                onClick={() => setMobileEditorOpen(true)}
            >
                <PencilLine size={17} aria-hidden="true" />
                Edit
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
                    errors={displayedValidationErrors}
                    updateField={updateField}
                    updateTheme={updateTheme}
                    updateMusicFile={updateMusicFile}
                    isUploadingMusic={isUploadingMusic}
                />
            </section>

            <div className="builderBottomBar">
                <button type="button" onClick={() => setMobileEditorOpen(true)}>
                    <PencilLine size={17} aria-hidden="true" />
                    <span>Edit Content</span>
                </button>
                <button type="button" onClick={saveAndPreview} disabled={isPreviewing || isPublishing}>
                    {isPreviewing ? <Loader2 size={17} className="spinner" /> : <Eye size={17} aria-hidden="true" />}
                    <span>Preview</span>
                </button>
                <button
                    type="button"
                    onClick={isEditingPublished ? handleUpdateInvitation : saveAndOpenPublish}
                    disabled={isPreviewing || isPublishing}
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
                    const startTime = Date.now();
                    const savedInvitation = await saveInvitation({ createIfNeeded: true, isExplicitUserSave: true });

                    if (savedInvitation) {
                        const elapsed = Date.now() - startTime;
                        if (elapsed < 400) {
                            await new Promise((resolve) => setTimeout(resolve, 400 - elapsed));
                        }
                        isIntentionalNavigationRef.current = true;
                        if (!openedFromExistingInvitation && invitation.status !== "published") {
                            router.replace("/invitations?status=draft");
                        } else {
                            router.replace(builderBackTarget);
                        }
                        return true;
                    }
                    return false;
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
                        sessionStorage.removeItem(builderLocalPreviewKey);
                        sessionStorage.removeItem(`vilique-new-draft-${invitation.id}`);
                        sessionStorage.removeItem(`vilique-builder-back-target-${invitation.id}`);
                        sessionStorage.removeItem(`vilique-builder-back-label-${invitation.id}`);
                    }
                    const publishedInvitation: InvitationData = {
                        ...invitation,
                        status: updatedInvitation.status,
                        publishedAt: updatedInvitation.published_at || new Date().toISOString(),
                        slug: updatedInvitation.slug,
                        updatedAt: new Date().toISOString(),
                        lifecycleStatus: updatedInvitation.status === "published" ? "published" : invitation.lifecycleStatus,
                        eventStatus: updatedInvitation.status === "published" ? "published" : invitation.eventStatus,
                    };
                    setInvitation(publishedInvitation);
                    invalidateInvitationsCache(publishedInvitation, invitation);
                    setSaveState(updatedInvitation.status === "published" ? "✓ Published" : "✓ Saved");
                    if (updatedInvitation.status === "published") {
                        setIsPublishModalOpen(false);
                        setPublishSuccessDetails({
                            slug: updatedInvitation.slug,
                            publishedAt: updatedInvitation.published_at,
                        });
                    }
                }}
            />

            <PublishSuccessModal
                details={publishSuccessDetails}
                onViewProfile={() => router.push("/invitations?status=upcoming")}
            />
        </main>
    );
}

function PublishSuccessModal({
    details,
    onViewProfile,
}: {
    details: PublishSuccessDetails | null;
    onViewProfile: () => void;
}) {
    const [copied, setCopied] = useState(false);

    if (!details) return null;

    const publicUrl = getPublicInvitationUrl(details.slug);

    function copyLink() {
        navigator.clipboard.writeText(publicUrl).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1800);
        });
    }

    return createPortal(
        <AnimatePresence>
            <div className="publishSuccessOverlay" role="dialog" aria-modal="true" aria-label="Invitation published">
                <motion.div
                    className="publishSuccessLockedBackdrop"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                />
                <motion.div
                    className="publishSuccessPanel"
                    initial={{ opacity: 0, scale: 0.96, y: 18 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: 18 }}
                    transition={{ type: "spring", duration: 0.42 }}
                >
                    <div className="publishSuccessTop">
                        <div className="publishSuccessIcon">
                            <Check size={24} strokeWidth={3} />
                        </div>
                        <div className="publishSuccessCopy">
                            <p>Payment successful</p>
                            <h2>Your invitation is live</h2>
                            <span>Guests can now open, view, and RSVP from your public invitation site.</span>
                        </div>
                    </div>

                    <div className="publishSuccessLinkBox">
                        <div>
                            <small>Public link</small>
                            <span>{publicUrl}</span>
                        </div>
                        <button type="button" onClick={copyLink}>
                            {copied ? <Check size={16} /> : <Copy size={16} />}
                            {copied ? "Copied" : "Copy link"}
                        </button>
                    </div>

                    <div className="publishSuccessActions publishSuccessDialogActions">
                        <a className="publishSuccessOpenBtn" href={publicUrl} target="_blank" rel="noreferrer">
                            <ExternalLink size={16} />
                            Open site
                        </a>
                        <button className="publishSuccessProfileBtn" type="button" onClick={onViewProfile}>
                            View in Invitations
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>,
        document.body
    );
}

function BuilderLoadingState() {
    return (
        <main className="builderShell builderLoadingShell" aria-busy="true">
            <div className="builderLoadingCard">
                <Loader2 className="builderLoadingSpinner spinner" size={22} aria-hidden="true" />
                <div className="builderLoadingCopy">
                    <strong>Opening builder</strong>
                    <span>Preparing your invitation workspace</span>
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
    onSave: () => Promise<boolean | void>;
    onDiscard: () => Promise<void> | void;
    onCancel: () => void;
}) {
    const [saving, setSaving] = useState(false);
    const [discarding, setDiscarding] = useState(false);

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
        try {
            const result = await onSave();
            if (result === false) {
                setSaving(false);
            }
        } catch (error) {
            console.error("Save failed", error);
            setSaving(false);
        }
    }

    async function handleDiscardConfirm() {
        setDiscarding(true);
        try {
            await onDiscard();
        } catch (error) {
            console.error("Discard failed", error);
            setDiscarding(false);
        }
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
                                    disabled={saving || discarding}
                                    style={{
                                        width: "100%",
                                        minHeight: "46px",
                                        borderRadius: "14px",
                                        border: "none",
                                        background: (saving || discarding)
                                            ? "#e5e7eb"
                                            : "linear-gradient(135deg, #8c4cf3 0%, #c46fb4 100%)",
                                        color: (saving || discarding) ? "#9ca3af" : "#fff",
                                        fontWeight: 800,
                                        fontSize: "14px",
                                        cursor: (saving || discarding) ? "not-allowed" : "pointer",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: "8px",
                                        transition: "all 0.2s",
                                        boxShadow: (saving || discarding) ? "none" : "0 4px 16px rgba(140, 76, 243, 0.3)",
                                    }}
                                >
                                    {saving ? <Loader2 size={15} className="spinner" /> : <Save size={15} />}
                                    {saving ? "Saving…" : "Save Draft"}
                                </button>
                            ) : null}

                            {/* Discard & Keep Editing row */}
                            <div style={{ display: "flex", gap: "8px", width: "100%" }}>
                                <button
                                    type="button"
                                    onClick={handleDiscardConfirm}
                                    disabled={saving || discarding}
                                    style={{
                                        flex: 1,
                                        minHeight: "42px",
                                        borderRadius: "12px",
                                        background: "#fef2f2",
                                        border: "1.5px solid rgba(239,68,68,0.2)",
                                        color: "#dc2626",
                                        fontWeight: 700,
                                        fontSize: "13.5px",
                                        cursor: (saving || discarding) ? "not-allowed" : "pointer",
                                        opacity: (saving || discarding) ? 0.7 : 1,
                                        transition: "all 0.2s",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: "6px",
                                    }}
                                >
                                    {discarding ? <Loader2 size={14} className="spinner" /> : null}
                                    <span>Discard</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={onCancel}
                                    disabled={saving || discarding}
                                    style={{
                                        flex: 1,
                                        minHeight: "42px",
                                        borderRadius: "12px",
                                        background: "#f9fafb",
                                        border: "1.5px solid #e5e7eb",
                                        color: "#6b7280",
                                        fontWeight: 700,
                                        fontSize: "13.5px",
                                        cursor: (saving || discarding) ? "not-allowed" : "pointer",
                                        opacity: (saving || discarding) ? 0.7 : 1,
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

function BuilderToolRail({
    activeTab,
    setActiveTab,
}: {
    activeTab: EditorTab;
    setActiveTab: (tab: EditorTab) => void;
}) {
    return (
        <nav className="builderToolRail" aria-label="Builder tools">
            {builderRailItems.map(({ id, label, icon: Icon }) => {
                const active = activeTab === id;

                return (
                    <button
                        key={id}
                        type="button"
                        className={active ? "active" : ""}
                        onClick={() => setActiveTab(id)}
                        title={label}
                    >
                        <span className="builderToolIcon">
                            <Icon size={18} aria-hidden="true" />
                        </span>
                        <span>{label}</span>
                    </button>
                );
            })}
        </nav>
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
    errors,
    updateField,
    updateTheme,
    updateMusicFile,
    isUploadingMusic,
}: {
    activeTab: EditorTab;
    invitation: ReturnType<typeof createDefaultInvitation>;
    errors: BuilderValidationErrors;
    updateField: (key: string, value: string) => void;
    updateTheme: (key: keyof InvitationData["theme"], value: InvitationData["theme"][keyof InvitationData["theme"]]) => void;
    updateMusicFile: (file: File | null) => void;
    isUploadingMusic: boolean;
}) {
    const { startTime, endTime } = parseTimeRange(invitation.eventTime);
    const [activePicker, setActivePicker] = useState<"date" | "startTime" | "endTime" | null>(null);
    const now = useMinuteNow(activeTab === "event");
    const selectedDate = parseDateValue(invitation.eventDate) || now;
    const minEventDate = getMinimumEventDate(now);
    const minEventDateValue = toDateInputValue(minEventDate);
    const selectedDateTime = startOfDate(selectedDate).getTime();
    const minEventDateTime = startOfDate(minEventDate).getTime();
    const minTimeMinutes = isSameDate(selectedDate, minEventDate) ? getNextSelectableMinute(now) : null;
    const maxStartTimeMinutes = 23 * 60 + 58;
    const endMinTimeMinutes = getMinimumEndTimeMinutes(startTime);
    const usesWeddingTitleDropdown = invitation.templateId === "pastel-floral-wedding";
    const selectedWeddingTitle = weddingTemplateTitleOptions.includes(invitation.title as typeof weddingTemplateTitleOptions[number])
        ? invitation.title
        : weddingTemplateDefaultTitle;

    useEffect(() => {
        if (activeTab !== "event") return;

        if (selectedDateTime < minEventDateTime) {
            updateField("eventDate", minEventDateValue);
            return;
        }

        let nextStartTime = startTime;
        let nextEndTime = endTime;

        if (!nextStartTime || !isSelectableTime(nextStartTime, minTimeMinutes, maxStartTimeMinutes)) {
            nextStartTime = fromMinutes(Math.min(Math.max(minTimeMinutes ?? 0, toMinutes(nextStartTime || "00:00")), maxStartTimeMinutes));
        }

        const minEndMinutes = getMinimumEndTimeMinutes(nextStartTime);
        if (!nextEndTime || !isSelectableTime(nextEndTime, minEndMinutes, null)) {
            nextEndTime = getPreferredEndTime(nextStartTime, minEndMinutes);
        }

        if (nextStartTime !== startTime || nextEndTime !== endTime) {
            updateField("eventTime", formatTimeRange(nextStartTime, nextEndTime));
        }
    }, [activeTab, endTime, maxStartTimeMinutes, minEventDateTime, minEventDateValue, minTimeMinutes, selectedDateTime, startTime, updateField]);

    useEffect(() => {
        if (!usesWeddingTitleDropdown) return;
        if (weddingTemplateTitleOptions.includes(invitation.title as typeof weddingTemplateTitleOptions[number])) return;
        updateField("title", weddingTemplateDefaultTitle);
    }, [invitation.title, updateField, usesWeddingTitleDropdown]);

    if (activeTab === "content") {
        return (
            <div className="editorForm">
                <label className={errors.title ? "hasError" : ""}>
                    <span>Title</span>
                    {usesWeddingTitleDropdown ? (
                        <select
                            data-field-key="title"
                            value={selectedWeddingTitle}
                            onChange={(e) => updateField("title", e.target.value)}
                            aria-invalid={!!errors.title}
                        >
                            {weddingTemplateTitleOptions.map((option) => (
                                <option value={option} key={option}>{option}</option>
                            ))}
                        </select>
                    ) : (
                        <input data-field-key="title" value={invitation.title} onChange={(e) => updateField("title", e.target.value)} maxLength={45} aria-invalid={!!errors.title} />
                    )}
                    {errors.title ? <small className="fieldError">{errors.title}</small> : null}
                </label>

                <label className={errors.primaryName ? "hasError" : ""}>
                    <span>Primary Name</span>
                    <input data-field-key="primaryName" value={invitation.primaryName} onChange={(e) => updateField("primaryName", e.target.value)} maxLength={25} aria-invalid={!!errors.primaryName} />
                    {errors.primaryName ? <small className="fieldError">{errors.primaryName}</small> : null}
                </label>

                <label className={errors.secondaryName ? "hasError" : ""}>
                    <span>Secondary Name</span>
                    <input data-field-key="secondaryName" value={invitation.secondaryName || ""} onChange={(e) => updateField("secondaryName", e.target.value)} maxLength={25} aria-invalid={!!errors.secondaryName} />
                    {errors.secondaryName ? <small className="fieldError">{errors.secondaryName}</small> : null}
                </label>

                <label className={errors.message ? "hasError" : ""}>
                    <span>Message</span>
                    <textarea data-field-key="message" value={invitation.message} onChange={(e) => updateField("message", e.target.value)} maxLength={200} aria-invalid={!!errors.message} />
                    {errors.message ? <small className="fieldError">{errors.message}</small> : null}
                </label>
            </div>
        );
    }

    if (activeTab === "event") {
        return (
            <div className="editorForm">
                <label className={errors.eventDate ? "hasError" : ""}>
                    <span>Date</span>
                    <div data-field-key="eventDate" tabIndex={-1}>
                        <DatePickerField
                            value={invitation.eventDate}
                            onChange={(value) => updateField("eventDate", value)}
                            isOpen={activePicker === "date"}
                            onToggle={(open) => setActivePicker(open ? "date" : null)}
                        />
                    </div>
                    {errors.eventDate ? <small className="fieldError">{errors.eventDate}</small> : null}
                </label>

                <label className={errors.eventTime ? "hasError" : ""}>
                    <span>Start Time</span>
                    <div data-field-key="eventTime" tabIndex={-1}>
                        <TimePickerField
                            value={startTime}
                            onChange={(value) => updateField("eventTime", normalizeTimeRangeForStart(value, endTime))}
                            minTimeMinutes={minTimeMinutes}
                            maxTimeMinutes={maxStartTimeMinutes}
                            isOpen={activePicker === "startTime"}
                            onToggle={(open) => setActivePicker(open ? "startTime" : null)}
                        />
                    </div>
                    {errors.eventTime ? <small className="fieldError">{errors.eventTime}</small> : null}
                </label>

                <label>
                    <span>End Time</span>
                    <TimePickerField
                        value={endTime}
                        onChange={(value) => updateField("eventTime", formatTimeRange(startTime, value))}
                        minTimeMinutes={endMinTimeMinutes}
                        maxTimeMinutes={null}
                        isOpen={activePicker === "endTime"}
                        onToggle={(open) => setActivePicker(open ? "endTime" : null)}
                    />
                </label>

                <label className={errors.venueName ? "hasError" : ""}>
                    <span>Venue Name</span>
                    <input data-field-key="venueName" value={invitation.venueName} onChange={(e) => updateField("venueName", e.target.value)} maxLength={45} aria-invalid={!!errors.venueName} />
                    {errors.venueName ? <small className="fieldError">{errors.venueName}</small> : null}
                </label>

                <label className={errors.venueAddress ? "hasError" : ""}>
                    <span>Venue Address</span>
                    <textarea data-field-key="venueAddress" value={invitation.venueAddress} onChange={(e) => updateField("venueAddress", e.target.value)} maxLength={120} aria-invalid={!!errors.venueAddress} />
                    {errors.venueAddress ? <small className="fieldError">{errors.venueAddress}</small> : null}
                </label>
            </div>
        );
    }

    if (activeTab === "contact") {
        return (
            <div className="editorForm">
                <label className={errors.phone ? "hasError" : ""}>
                    <span>Primary Phone</span>
                    <input
                        data-field-key="phone"
                        type="tel"
                        inputMode="numeric"
                        pattern="[0-9]{10}"
                        value={invitation.phone || ""}
                        onChange={(e) => updateField("phone", e.target.value.replace(/\D/g, "").slice(0, 10))}
                        maxLength={10}
                        aria-invalid={!!errors.phone}
                    />
                    {errors.phone ? <small className="fieldError">{errors.phone}</small> : null}
                </label>

                <label className={errors.secondaryPhone ? "hasError" : ""}>
                    <span>Secondary Phone</span>
                    <input
                        data-field-key="secondaryPhone"
                        type="tel"
                        inputMode="numeric"
                        pattern="[0-9]{10}"
                        value={invitation.secondaryPhone || ""}
                        onChange={(e) => updateField("secondaryPhone", e.target.value.replace(/\D/g, "").slice(0, 10))}
                        maxLength={10}
                        aria-invalid={!!errors.secondaryPhone}
                    />
                    {errors.secondaryPhone ? <small className="fieldError">{errors.secondaryPhone}</small> : null}
                </label>

                <label className={errors.mapLink ? "hasError" : ""}>
                    <span>Map Link</span>
                    <input
                        data-field-key="mapLink"
                        type="url"
                        inputMode="url"
                        value={invitation.mapLink}
                        onChange={(e) => updateField("mapLink", e.target.value)}
                        maxLength={250}
                        aria-invalid={!!errors.mapLink}
                    />
                    {errors.mapLink ? <small className="fieldError">{errors.mapLink}</small> : null}
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
            <div className={`editorSoundField ${errors.musicUrl ? "hasError" : ""}`}>
                <span className="editorFieldLabel">Celebration Song</span>
                <div data-field-key="musicUrl" tabIndex={-1}>
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
                        isUploading={isUploadingMusic}
                        uploadId="musicUploadInput"
                    />
                </div>
                {errors.musicUrl ? <small className="fieldError">{errors.musicUrl}</small> : null}
            </div>


            {/* ── Clock Ticking Sound (read-only) ── */}
            <div className="editorSoundField">
                <span className="editorFieldLabel">Clock Ticking Sound</span>
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
                <p className="soundHelperText" style={{
                    fontSize: "var(--sound-helper-font, 10px)",
                    color: "#9ca3af",
                    marginTop: "6px",
                    lineHeight: 1.35,
                    paddingLeft: "2px",
                }}>
                    This sound plays in the background automatically. It&apos;s set by the template and cannot be changed.
                </p>
            </div>

            {/* ── Play Duration ── */}
            <label>
                <span>Song Play Duration</span>
                <div className="soundDurationOptions" style={{ display: "flex", gap: "7px", marginTop: "7px" }}>
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
                                    border: isSelected ? "2px solid #d8bfff" : "1px solid rgba(23, 23, 23, 0.08)",
                                    background: isSelected ? "#ead8ff" : "#fff",
                                    color: isSelected ? "#6f43e8" : "#4b5563",
                                    fontSize: "var(--sound-duration-font, 13px)",
                                    fontWeight: isSelected ? 800 : 650,
                                    cursor: "pointer",
                                    transition: "all 0.2s",
                                    boxShadow: isSelected ? "0 3px 10px rgba(140, 76, 243, 0.12)" : "none",
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
    isOpen,
    onToggle,
}: {
    value: string;
    onChange: (value: string) => void;
    isOpen: boolean;
    onToggle: (open: boolean) => void;
}) {
    const now = useMinuteNow(isOpen);
    const minDate = useMemo(() => getMinimumEventDate(now), [now]);
    const selectedDate = parseDateValue(value) || minDate;
    const [visibleMonth, setVisibleMonth] = useState(() => selectedDate || new Date());
    const minVisibleMonth = startOfMonth(minDate);
    const canGoPreviousMonth = startOfMonth(visibleMonth).getTime() > minVisibleMonth.getTime();
    const calendarDays = getCalendarDays(visibleMonth);

    useEffect(() => {
        if (!isValidDateValue(value)) {
            onChange(toDateInputValue(minDate));
        }
    }, [minDate, onChange, value]);

    function selectDate(date: Date) {
        if (isPastDate(date, minDate)) return;
        onChange(toDateInputValue(date));
        setVisibleMonth(date);
        onToggle(false);
    }

    function goToPreviousMonth() {
        if (!canGoPreviousMonth) return;
        setVisibleMonth((current) => {
            const previousMonth = startOfMonth(addMonths(current, -1));
            return previousMonth.getTime() < minVisibleMonth.getTime() ? minVisibleMonth : previousMonth;
        });
    }

    function toggleOpen(open: boolean) {
        if (open && startOfMonth(visibleMonth).getTime() < minVisibleMonth.getTime()) {
            setVisibleMonth(minVisibleMonth);
        }
        onToggle(open);
    }

    return (
        <div className="customPicker">
            <button
                className="customPickerTrigger"
                type="button"
                onClick={() => toggleOpen(!isOpen)}
            >
                <span>{formatDisplayDate(selectedDate)}</span>
                <CalendarDays size={18} aria-hidden="true" />
            </button>

            {isOpen ? (
                <PickerModal title="Choose date" variant="date" onClose={() => onToggle(false)}>
                    <div className="customPickerPopover datePickerPopover">
                        <div className="customPickerHeader">
                            <strong>
                                {visibleMonth.toLocaleString("en", { month: "long", year: "numeric" })}
                            </strong>
                            <div>
                                <button
                                    type="button"
                                    onClick={goToPreviousMonth}
                                    aria-label="Previous month"
                                    disabled={!canGoPreviousMonth}
                                >
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
                                const isDisabled = isPastDate(date, minDate);

                                return (
                                    <button
                                        className={[
                                            isSelected ? "selected" : "",
                                            !isCurrentMonth ? "muted" : "",
                                            isDisabled ? "disabled" : "",
                                        ].filter(Boolean).join(" ") || undefined}
                                        disabled={isDisabled}
                                        key={date.toISOString()}
                                        type="button"
                                        onClick={() => selectDate(date)}
                                    >
                                        {date.getDate()}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </PickerModal>
            ) : null}
        </div>
    );
}

function TimePickerField({
    value,
    onChange,
    minTimeMinutes,
    maxTimeMinutes,
    isOpen,
    onToggle,
}: {
    value: string;
    onChange: (value: string) => void;
    minTimeMinutes: number | null;
    maxTimeMinutes: number | null;
    isOpen: boolean;
    onToggle: (open: boolean) => void;
}) {
    const parsed = parseTimeInputParts(value);

    function updateTime(next: Partial<ReturnType<typeof parseTimeInputParts>>) {
        const nextValue = toTimeInputFromParts({ ...parsed, ...next });
        if (!isSelectableTime(nextValue, minTimeMinutes, maxTimeMinutes)) return;
        onChange(nextValue);
    }

    return (
        <div className="customPicker">
            <button
                className="customPickerTrigger"
                type="button"
                onClick={() => onToggle(!isOpen)}
            >
                <span>{value ? fromTimeInputValue(value) : "Select time"}</span>
                <Clock3 size={18} aria-hidden="true" />
            </button>

            {isOpen ? (
                <PickerModal title="Choose time" variant="time" onClose={() => onToggle(false)}>
                    <div className="customPickerPopover timePickerPopover">
                        <div className="timePickerSummary">
                            <span>Selected time</span>
                            <strong>{fromTimeInputValue(toTimeInputFromParts(parsed))}</strong>
                        </div>
                        <div className="timePickerColumns">
                            <div className="timePickerColGroup">
                                <span className="timePickerColLabel">Hour</span>
                                <PickerColumn
                                    values={Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0"))}
                                    selected={parsed.hour}
                                    isDisabled={(hour) => !isSelectableTime(toTimeInputFromParts({ ...parsed, hour }), minTimeMinutes, maxTimeMinutes)}
                                    onSelect={(hour) => updateTime({ hour })}
                                />
                            </div>
                            <div className="timePickerColGroup">
                                <span className="timePickerColLabel">Min</span>
                                <PickerColumn
                                    values={Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"))}
                                    selected={parsed.minute}
                                    isDisabled={(minute) => !isSelectableTime(toTimeInputFromParts({ ...parsed, minute }), minTimeMinutes, maxTimeMinutes)}
                                    onSelect={(minute) => updateTime({ minute })}
                                />
                            </div>
                            <div className="timePickerColGroup">
                                <span className="timePickerColLabel">Period</span>
                                <PickerColumn
                                    values={["AM", "PM"]}
                                    selected={parsed.period}
                                    isDisabled={(period) => !isSelectableTime(toTimeInputFromParts({ ...parsed, period: period as "AM" | "PM" }), minTimeMinutes, maxTimeMinutes)}
                                    onSelect={(period) => updateTime({ period: period as "AM" | "PM" })}
                                />
                            </div>
                        </div>

                        <div className="customPickerFooter single">
                            <button type="button" onClick={() => onToggle(false)}>Done</button>
                        </div>
                    </div>
                </PickerModal>
            ) : null}
        </div>
    );
}

function PickerColumn({
    values,
    selected,
    isDisabled,
    onSelect,
}: {
    values: string[];
    selected: string;
    isDisabled?: (value: string) => boolean;
    onSelect: (value: string) => void;
}) {
    return (
        <div className="timePickerColumn">
            {values.map((value) => {
                const disabled = isDisabled?.(value) || false;

                return (
                    <button
                        className={[
                            value === selected ? "selected" : "",
                            disabled ? "disabled" : "",
                        ].filter(Boolean).join(" ") || undefined}
                        disabled={disabled}
                        key={value}
                        type="button"
                        onClick={() => onSelect(value)}
                    >
                        {value}
                    </button>
                );
            })}
        </div>
    );
}

function PickerModal({
    title,
    variant,
    children,
    onClose,
}: {
    title: string;
    variant: "date" | "time";
    children: ReactNode;
    onClose: () => void;
}) {
    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") onClose();
        }

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    if (typeof document === "undefined") return null;

    return createPortal(
        <div className="customPickerSheetOverlay" role="presentation" onMouseDown={onClose}>
            <section
                className={`customPickerSheet customPickerSheet--${variant}`}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                onMouseDown={(event) => event.stopPropagation()}
            >
                <div className="customPickerSheetHandle" aria-hidden="true" />
                <div className="customPickerSheetHeader">
                    <strong>{title}</strong>
                    <button className="customPickerSheetClose" type="button" onClick={onClose} aria-label="Close picker">
                        <X size={16} aria-hidden="true" />
                    </button>
                </div>
                {children}
            </section>
        </div>,
        document.body
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

function useMinuteNow(enabled: boolean) {
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        if (!enabled) return;
        const interval = window.setInterval(() => {
            setNow(new Date());
        }, 30000);

        return () => window.clearInterval(interval);
    }, [enabled]);

    return now;
}

function startOfDate(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

function isPastDate(date: Date, minDate: Date) {
    return startOfDate(date).getTime() < minDate.getTime();
}

function getNextSelectableMinute(date: Date) {
    const nextMinute = new Date(date.getTime() + 60 * 1000);
    return nextMinute.getHours() * 60 + nextMinute.getMinutes();
}

function getMinimumEventDate(date: Date) {
    const nextMinute = new Date(date.getTime() + 60 * 1000);
    if (nextMinute.getHours() * 60 + nextMinute.getMinutes() > 23 * 60 + 58) {
        return startOfDate(new Date(nextMinute.getFullYear(), nextMinute.getMonth(), nextMinute.getDate() + 1));
    }
    return startOfDate(nextMinute);
}

function toMinutes(value: string) {
    const [hours = "0", minutes = "0"] = value.split(":");
    return Number(hours) * 60 + Number(minutes);
}

function fromMinutes(value: number) {
    const clamped = Math.max(0, Math.min(value, 23 * 60 + 59));
    const hours = Math.floor(clamped / 60);
    const minutes = clamped % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function isSelectableTime(value: string, minTimeMinutes: number | null, maxTimeMinutes: number | null = null) {
    const minutes = toMinutes(value);
    if (minTimeMinutes !== null && minutes < minTimeMinutes) return false;
    if (maxTimeMinutes !== null && minutes > maxTimeMinutes) return false;
    return true;
}

export function getMinimumEndTimeMinutes(startTime: string) {
    const startEndMinimum = startTime ? Math.min(toMinutes(startTime) + 1, 23 * 60 + 59) : null;
    return startEndMinimum;
}

function getPreferredEndTime(startTime: string, minEndTimeMinutes: number | null) {
    const preferredEndMinutes = startTime ? toMinutes(startTime) + 60 : 21 * 60;
    return fromMinutes(Math.max(minEndTimeMinutes ?? 0, preferredEndMinutes));
}

function normalizeTimeRangeForStart(startTime: string, endTime: string) {
    const minEndTimeMinutes = getMinimumEndTimeMinutes(startTime);
    const nextEndTime = endTime && isSelectableTime(endTime, minEndTimeMinutes)
        ? endTime
        : getPreferredEndTime(startTime, minEndTimeMinutes);
    return formatTimeRange(startTime, nextEndTime);
}

function parseDateValue(value: string) {
    const parts = parseInvitationDateParts(value);
    if (!parts) return null;
    return new Date(parts.year, parts.month - 1, parts.day);
}

function isValidDateValue(value: string) {
    return normalizeInvitationDateValue(value) !== null;
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
    const defaults = createDefaultInvitation();
    const normalizedEventDate = normalizeInvitationDateValue(invitation.eventDate);
    const invitationWithDefaults = {
        ...invitation,
        phone: invitation.phone || defaults.phone,
        secondaryPhone: invitation.secondaryPhone || defaults.secondaryPhone,
    };

    if (normalizedEventDate) {
        return {
            ...invitationWithDefaults,
            eventDate: normalizedEventDate,
        };
    }

    return {
        ...invitationWithDefaults,
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

    useEffect(() => {
        stopPreview();
    }, [url]);

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
    isUploading = false,
    uploadId,
}: {
    icon: string;
    title: string;
    subtitle: string;
    url?: string;
    badge?: "default" | "custom";
    onRemove?: () => void;
    onUpload?: (file: File) => void;
    isUploading?: boolean;
    uploadId?: string;
}) {
    const { playing, toggle } = useAudioPreview(url);

    return (
        <div className="soundPreviewCard" style={{
            borderRadius: "13px",
            border: "1px solid rgba(126, 91, 213, 0.12)",
            background: badge === "custom"
                ? "rgba(126, 91, 213, 0.04)"
                : "rgba(248, 246, 255, 0.9)",
            overflow: "hidden",
            marginTop: "7px",
        }}>
            <div className="soundPreviewMain" style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "12px 13px",
            }}>
                <span className="soundPreviewIcon" style={{ fontSize: "var(--sound-icon-font, 20px)", lineHeight: 1, flex: "0 0 auto" }}>{icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px", minWidth: 0 }}>
                        <span className="soundPreviewTitle" style={{
                            minWidth: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            fontSize: "var(--sound-title-font, 12px)",
                            fontWeight: 850,
                            color: "#1a1a1a",
                            letterSpacing: "0.02em",
                        }}>{title}</span>
                        {badge && (
                            <span className="soundPreviewBadge" style={{
                                flex: "0 0 auto",
                                fontSize: "var(--sound-badge-font, 8px)",
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
                    <span className="soundPreviewSubtitle" style={{
                        display: "block",
                        maxWidth: "100%",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        fontSize: "var(--sound-subtitle-font, 10.5px)",
                        color: "#9ca3af",
                        lineHeight: 1.22,
                    }}>
                        {subtitle}
                    </span>
                </div>
                <div className="soundPreviewActions" style={{ display: "flex", alignItems: "center", gap: "6px", flex: "0 0 auto" }}>
                    {url && (
                        <button
                            type="button"
                            onClick={toggle}
                            className="soundPreviewPlay"
                            style={{
                                width: "var(--sound-play-size, 34px)",
                                minWidth: "var(--sound-play-size, 34px)",
                                height: "var(--sound-play-size, 34px)",
                                minHeight: "var(--sound-play-size, 34px)",
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
                                flex: "0 0 var(--sound-play-size, 34px)",
                            }}
                        >
                            {playing ? <Pause size={12} /> : <Play size={12} />}
                        </button>
                    )}
                    {onRemove && (
                        <button
                            type="button"
                            onClick={() => {
                                stopActiveSoundPreview();
                                onRemove();
                            }}
                            disabled={isUploading}
                            style={{
                                height: "30px",
                                minHeight: "30px",
                                padding: "0 8px",
                                borderRadius: "7px",
                                background: "#fee2e2",
                                color: "#ef4444",
                                fontSize: "var(--sound-remove-font, 9.5px)",
                                fontWeight: 800,
                                border: "none",
                                cursor: isUploading ? "not-allowed" : "pointer",
                                opacity: isUploading ? 0.55 : 1,
                                flex: "0 0 auto",
                            }}
                        >
                            Remove
                        </button>
                    )}
                </div>
            </div>
            {onUpload && uploadId && (
                <div className="soundUploadRow" style={{
                    borderTop: "1px dashed rgba(126, 91, 213, 0.12)",
                    padding: "10px 13px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: isUploading ? "wait" : "pointer",
                    opacity: isUploading ? 0.88 : 1,
                }}
                    onClick={() => {
                        if (isUploading) return;
                        stopActiveSoundPreview();
                        document.getElementById(uploadId)?.click();
                    }}
                >
                    {isUploading ? (
                        <Loader2 size={14} className="spinner" style={{ color: "#7e5bd5", flex: "0 0 auto" }} />
                    ) : (
                        <span className="soundUploadIcon" style={{ fontSize: "var(--sound-upload-icon-font, 12px)", flex: "0 0 auto" }}>📤</span>
                    )}
                    <span className="soundUploadText" style={{ fontSize: "var(--sound-upload-font, 11.5px)", color: "#7e5bd5", fontWeight: 750, letterSpacing: "0.015em" }}>
                        {isUploading ? "Uploading song..." : "Upload custom song to replace"}
                    </span>
                    <input
                        id={uploadId}
                        type="file"
                        accept="audio/*"
                        disabled={isUploading}
                        style={{ display: "none" }}
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                                stopActiveSoundPreview();
                                onUpload(file);
                            }
                        }}
                    />
                </div>
            )}
        </div>
    );
}
