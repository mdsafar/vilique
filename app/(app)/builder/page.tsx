"use client";
/* eslint-disable react-hooks/immutability */

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/Toast";
import { useSWRConfig } from "swr";
import { mutateInvitationState } from "@/lib/invitationCache";
import { createDemoCountdownTargetDate } from "@/lib/demoCountdown";
import { templates } from "@/data/templates";
import type { InvitationData } from "@/types/invitation";
import {
    validateInvitationFields,
    type BuilderValidationErrors,
    type BuilderValidationFieldKey,
} from "@/features/invitations/validation";
import BuilderLoadingState from "@/features/builder/components/BuilderLoadingState";
import { useLineLoader } from "@/components/TopLineLoader";
import * as builderDateUtils from "@/features/builder/lib/builderDateUtils";
import type {
    BuilderMode,
    BuilderUpdateSource,
    EditorTab,
    PreviewDeviceMode,
    PreviewScreen,
    PublishSuccessDetails,
    SaveStatus,
} from "@/features/builder/types";
import RecoveryModal from "@/features/builder/components/RecoveryModal";
import BuilderTopbar from "@/features/builder/components/BuilderTopbar";
import BuilderBottomBar from "@/features/builder/components/BuilderBottomBar";
import MobileEditorSheet from "@/features/builder/components/MobileEditorSheet";
import DesktopEditorPanel from "@/features/builder/components/DesktopEditorPanel";
import BuilderLivePreview from "@/features/builder/components/BuilderLivePreview";
import MobileEditorTrigger from "@/features/builder/components/MobileEditorTrigger";
import BuilderRouteFallback from "@/features/builder/components/BuilderRouteFallback";
import BuilderProtectedContent from "@/features/builder/components/BuilderProtectedContent";
import BuilderModals, {
    type PublishModalSuccessPayload,
} from "@/features/builder/components/BuilderModals";
import {
    builderLocalPreviewKey,
    builderPreviewSnapshotMaxAgeMs,
    getBuilderPreviewKey,
    readBuilderPreviewSnapshot,
    type BuilderPreviewSnapshot,
} from "@/features/builder/lib/builderPreviewSession";
import {
    formatSaveError,
    requiredFieldTabs,
} from "@/features/builder/lib/builderValidationUtils";
import {
    buildComparablePayload,
    buildSavePayload,
} from "@/features/builder/lib/builderPayloadUtils";
import {
    resolveBuilderBackTarget,
} from "@/features/builder/lib/builderNavigationUtils";
import {
    getBuilderSaveStatusLabel,
} from "@/features/builder/lib/builderStatusUtils";
import BuilderAuthRequiredState from "@/features/builder/components/BuilderAuthRequiredState";
import {
    createFreshBuilderInvitation,
} from "@/features/builder/lib/builderInvitationUtils";
import { builderLockHeaders, isBuilderConflictCode } from "@/features/builder/lib/builderLock";
import { useInvitationEditorLock } from "@/features/builder/hooks/useInvitationEditorLock";
import BuilderLockBanner from "@/features/builder/components/BuilderLockBanner";
import { isRecoverableTemporaryDraft } from "@/features/builder/lib/temporaryDraftRecovery";


export default function BuilderPage() {
    return (
        <Suspense
            fallback={
                <BuilderRouteFallback
                    storageKey={
                        builderLocalPreviewKey
                    }
                    maxAgeMs={
                        builderPreviewSnapshotMaxAgeMs
                    }
                />
            }
        >
            <BuilderProtectedContent>
                <BuilderContent />
            </BuilderProtectedContent>
        </Suspense>
    );
}

interface RecoveryData {
    draftId: string;
    timestamp: number;
    baselinePayload?: string;
    recoveredPayload?: string;
    builderMode?: BuilderMode;
}

function BuilderContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { showToast } = useToast();
    const { cache, mutate: globalMutate } = useSWRConfig();

    const existingId = searchParams.get("id");
    const templateKey = searchParams.get("template") || "pastel-floral-wedding";
    const openedFromTemplateDetails = searchParams.get("from") === "template-details";

    // Preview is part of the same Builder session. Read its snapshot before the
    // normal ID-based server loader so returning from Preview cannot reset the
    // original baseline, Builder mode, or dirty-session decision.
    const initialPreviewSnapshot = useMemo(
        () => readBuilderPreviewSnapshot(templateKey, existingId),
        [existingId, templateKey],
    );
    const isBrowserReload = useMemo(() => {
        if (typeof performance === "undefined") return false;
        return (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined)?.type === "reload";
    }, []);

    const initialInvitation = useMemo(
        () =>
            initialPreviewSnapshot
                ? builderDateUtils.normalizeInvitationDate(
                    initialPreviewSnapshot.invitation,
                )
                : createFreshBuilderInvitation(
                    templateKey,
                ),
        [
            initialPreviewSnapshot,
            templateKey,
        ],
    );

    // Dynamic Scoped Storage Keys
    const scopedRecoveryKey = useMemo(
        () => `vilique-builder:recovery:template:${templateKey}`,
        [templateKey],
    );

    const scopedPreviewKey = useMemo(
        () =>
            getBuilderPreviewKey(
                templateKey,
                existingId,
            ),
        [existingId, templateKey],
    );

    // Structural State. A valid Preview snapshot initializes synchronously so
    // the Builder does not paint BuilderLoadingState while returning.
    const [invitation, setInvitation] = useState<InvitationData>(initialInvitation);
    const [authStatus, setAuthStatus] = useState<"authed" | "guest">("authed");
    const [isLoadingInvitation, setIsLoadingInvitation] = useState(!initialPreviewSnapshot);
    const [isInitialized, setIsInitialized] = useState(Boolean(initialPreviewSnapshot));
    const [showRecoveryModal, setShowRecoveryModal] = useState(false);
    const [recoveredDraftId, setRecoveredDraftId] = useState<string | null>(null);
    const [recoveredDraftTimestamp, setRecoveredDraftTimestamp] = useState<number | string | null>(null);
    const [lockOverlayDismissed, setLockOverlayDismissed] = useState(false);
    const [isTakingOverLock, setIsTakingOverLock] = useState(false);
    const [lockInvitationId, setLockInvitationId] = useState<string | null>(
        initialPreviewSnapshot?.invitationId ?? existingId,
    );

    // Lifecycle & Save State
    const [builderMode, setBuilderMode] = useState<BuilderMode>(
        initialPreviewSnapshot?.builderMode ?? "new",
    );
    const [saveStatus, setSaveStatus] = useState<SaveStatus>(
        initialPreviewSnapshot?.saveStatus ?? "idle",
    );
    const [validationErrors, setValidationErrors] = useState<BuilderValidationErrors>({});

    // UI Viewport State
    const [activeTab, setActiveTab] = useState<EditorTab>("content");
    const [previewScreen, setPreviewScreen] = useState<PreviewScreen>("invite");
    const [
        previewDeviceMode,
        setPreviewDeviceMode,
    ] = useState<PreviewDeviceMode>(
        "mobile",
    );
    const [editorCollapsed, setEditorCollapsed] = useState(false);
    const [demoCountdownTargetDate, setDemoCountdownTargetDate] = useState<Date | null>(createDemoCountdownTargetDate);
    const [mobileEditorOpen, setMobileEditorOpen] = useState(false);
    const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
    const [leaveModalOpen, setLeaveModalOpen] = useState(false);
    const [isPreviewing, setIsPreviewing] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [isUploadingMusic, setIsUploadingMusic] = useState(false);
    const [isSavingDraftAndLeaving, setIsSavingDraftAndLeaving] =
        useState(false);
    const [publishSuccessDetails, setPublishSuccessDetails] = useState<PublishSuccessDetails | null>(null);
    const [previewScrolledToBottom, setPreviewScrolledToBottom] = useState(false);
    const previewViewportRef = useRef<HTMLDivElement>(null);

    // Concurrency & Semantic Tracking Refs
    const requiresExitDecisionRef = useRef(
        initialPreviewSnapshot?.requiresExitDecision ?? false,
    );
    const invitationRef = useRef(invitation);
    const recoveryDataRef = useRef<RecoveryData | null>(null);
    const [hasUserEditedState, setHasUserEditedState] = useState(initialPreviewSnapshot?.hasUserEdited ?? false);
    const hasUserEditedRef = useRef(initialPreviewSnapshot?.hasUserEdited ?? false);
    const setHasUserEdited = useCallback((edited: boolean) => {
        hasUserEditedRef.current = edited;
        setHasUserEditedState(edited);
    }, []);

    // Sync recovery data to localStorage on every edit for draft-edit and published-edit modes
    useEffect(() => {
        if (!isInitialized || !hasUserEditedRef.current || isSessionFinalizedRef.current) return;
        if (builderMode !== "draft-edit" && builderMode !== "published-edit") return;

        const draftId = latestDraftId.current || existingId;
        if (draftId && draftId !== "default-draft-placeholder-id") {
            const currentPayload = JSON.stringify(invitation);
            localStorage.setItem(
                scopedRecoveryKey,
                JSON.stringify({
                    draftId,
                    timestamp: Date.now(),
                    baselinePayload: baselinePayloadRef.current,
                    recoveredPayload: currentPayload,
                    builderMode,
                }),
            );
        }
    }, [invitation, isInitialized, existingId, scopedRecoveryKey, builderMode]);
    const baselinePayloadRef = useRef(initialPreviewSnapshot?.baselinePayload ?? "");
    const [baselineComparablePayloadState] = useState(
        initialPreviewSnapshot?.baselineComparablePayload ?? "",
    );
    const baselineComparablePayloadRef = useRef(
        initialPreviewSnapshot?.baselineComparablePayload ?? "",
    );
    const lastPersistedPayloadRef = useRef(initialPreviewSnapshot?.lastPersistedPayload ?? "");
    const latestDraftId = useRef<string | null>(
        initialPreviewSnapshot?.invitationId
        ?? (invitation.id !== "default-draft-placeholder-id" ? invitation.id : null),
    );

    // Locks and Timers
    const publishPreviousInvitationRef = useRef<InvitationData | null>(null);
    const publishedInvitationForNavigationRef = useRef<InvitationData | null>(null);
    const pendingSaveController = useRef<AbortController | null>(null);
    const activeSavePromise = useRef<Promise<boolean> | null>(null);
    const activeSaveIsCreateRef = useRef(false);
    const saveTimerRef = useRef<number | null>(null);
    const isIntentionalNavigationRef = useRef(false);
    const isSessionFinalizedRef = useRef(false);
    const navigationCommittedRef = useRef(false);
    const saveRequestRevisionRef = useRef(0);

    const cancelPendingEditsForLockLoss = useCallback(() => {
        saveRequestRevisionRef.current += 1;
        pendingSaveController.current?.abort();
        pendingSaveController.current = null;
        if (saveTimerRef.current !== null) {
            window.clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
        }
        setSaveStatus("readonly");
        setMobileEditorOpen(false);
        setIsPublishModalOpen(false);
    }, []);

    const refreshCanonicalInvitation = useCallback(async (): Promise<number | null> => {
        const id = lockInvitationId ?? existingId ?? latestDraftId.current;
        if (!id) return 0;
        try {
            const response = await fetch(`/api/invitations/${id}`, { cache: "no-store" });
            if (!response.ok) return null;
            const draft = await response.json();
            const normalized = builderDateUtils.normalizeInvitationDate(draft);
            invitationRef.current = normalized;
            setInvitation(normalized);
            latestDraftId.current = normalized.id;
            setLockInvitationId(normalized.id);
            const payload = buildSavePayload(normalized);
            if (!requiresExitDecisionRef.current) {
                baselinePayloadRef.current = payload;
                baselineComparablePayloadRef.current = buildComparablePayload(normalized);
                hasUserEditedRef.current = false;
                setHasUserEditedState(false);
                requiresExitDecisionRef.current = false;
            }
            lastPersistedPayloadRef.current = payload;
            setSaveStatus("idle");
            return Number.isSafeInteger(normalized.revision) ? Number(normalized.revision) : 0;
        } catch {
            return null;
        }
    }, [existingId, lockInvitationId]);

    const editorLock = useInvitationEditorLock({
        invitationId: lockInvitationId,
        onRefreshCanonical: refreshCanonicalInvitation,
        onLostOwnership: cancelPendingEditsForLockLoss,
        preserveLocalOnResume: Boolean(initialPreviewSnapshot) && !isBrowserReload,
        resumeRevision: initialPreviewSnapshot?.invitation.revision ?? null,
        autoTakeover: builderMode === "new" || Boolean(recoveredDraftId),
    });

    // Sync ref to always hold latest invitation without triggering stale closures
    useEffect(() => {
        invitationRef.current = invitation;
    }, [invitation]);

    const { startLineLoader, finishLineLoader } = useLineLoader();

    // Trigger top line loader during autosave / save status updates
    useEffect(() => {
        if (saveStatus === "saving") {
            startLineLoader();
        } else if (saveStatus === "saved" || saveStatus === "error") {
            finishLineLoader();
        }
    }, [saveStatus, startLineLoader, finishLineLoader]);

    // Scroll listener for preview viewport & window to toggle scroll indicator cue
    useEffect(() => {
        if (!isInitialized) return;

        const checkScrollPosition = () => {
            const viewport = previewViewportRef.current;
            if (!viewport) return;

            // 1. Container scroll check (Desktop preview viewport or scrollable element)
            const hasContainerScroll = viewport.scrollHeight > viewport.clientHeight + 20;
            const isContainerAtBottom =
                hasContainerScroll &&
                viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 30;

            // 2. Window scroll check (Mobile viewport where outer page body scrolls)
            const hasWindowScroll = document.documentElement.scrollHeight > window.innerHeight + 60;
            const isWindowAtBottom =
                hasWindowScroll &&
                window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 30;

            let isAtBottom = false;
            if (!hasContainerScroll && !hasWindowScroll) {
                // Content fits completely without scrolling
                isAtBottom = true;
            } else if (hasContainerScroll) {
                isAtBottom = isContainerAtBottom;
            } else if (hasWindowScroll) {
                isAtBottom = isWindowAtBottom;
            }

            setPreviewScrolledToBottom((prev) => (prev !== isAtBottom ? isAtBottom : prev));
        };

        const viewport = previewViewportRef.current;
        checkScrollPosition();

        if (viewport) {
            viewport.addEventListener("scroll", checkScrollPosition, { passive: true });
        }
        window.addEventListener("scroll", checkScrollPosition, { passive: true });
        window.addEventListener("resize", checkScrollPosition, { passive: true });

        const timeoutId = setTimeout(checkScrollPosition, 300);

        return () => {
            clearTimeout(timeoutId);
            if (viewport) {
                viewport.removeEventListener("scroll", checkScrollPosition);
            }
            window.removeEventListener("scroll", checkScrollPosition);
            window.removeEventListener("resize", checkScrollPosition);
        };
    }, [isInitialized, invitation, previewScreen]);

    const builderBackTarget = useMemo(
        () =>
            resolveBuilderBackTarget({
                returnToParam:
                    searchParams.get(
                        "returnTo",
                    ),
                previewExitTarget:
                    initialPreviewSnapshot
                        ?.builderExitTarget,
                builderMode,
                openedFromTemplateDetails,
                templateKey,
                existingId,
            }),
        [
            builderMode,
            existingId,
            initialPreviewSnapshot,
            openedFromTemplateDetails,
            searchParams,
            templateKey,
        ],
    );

    // 1. Session Initialization & Recovery Checking
    useEffect(() => {
        let isMounted = true;

        async function loadBuilder() {
            isSessionFinalizedRef.current = false;
            navigationCommittedRef.current = false;
            isIntentionalNavigationRef.current = false;

            // This branch must run before the existingId fetch. Preview may return
            // with a plain /builder?id=... URL, so matching a fresh snapshot is the
            // source of truth even when previewReturn=1 is not present.
            if (initialPreviewSnapshot) {
                const restored = builderDateUtils.normalizeInvitationDate(initialPreviewSnapshot.invitation);
                invitationRef.current = restored;
                setInvitation(restored);
                latestDraftId.current = initialPreviewSnapshot.invitationId
                    ?? (restored.id !== "default-draft-placeholder-id" ? restored.id : null);
                baselinePayloadRef.current = initialPreviewSnapshot.baselinePayload
                    || buildSavePayload(restored);
                baselineComparablePayloadRef.current = initialPreviewSnapshot.baselineComparablePayload
                    || buildComparablePayload(restored);
                lastPersistedPayloadRef.current = initialPreviewSnapshot.lastPersistedPayload
                    || buildSavePayload(restored);
                hasUserEditedRef.current = initialPreviewSnapshot.hasUserEdited;
                setBuilderMode(initialPreviewSnapshot.builderMode);
                setSaveStatus(initialPreviewSnapshot.saveStatus);
                setShowRecoveryModal(false);
                setIsLoadingInvitation(false);
                setIsInitialized(true);
                return;
            }

            hasUserEditedRef.current = false;

            const recoveryData = localStorage.getItem(scopedRecoveryKey);
            if (recoveryData) {
                try {
                    const parsed = JSON.parse(recoveryData);
                    const isMatch = existingId 
                        ? parsed.draftId === existingId 
                        : (typeof parsed.draftId === "string" && parsed.draftId && (parsed.builderMode === "new" || !parsed.builderMode));

                    if (isMatch) {
                        const recoveryResponse = await fetch(
                            `/api/invitations/${parsed.draftId}`,
                            { cache: "no-store" },
                        );

                        if (recoveryResponse.ok) {
                            const recoveryInvitation = await recoveryResponse.json();
                            const isRecoverable = existingId
                                ? (parsed.builderMode === "draft-edit" || parsed.builderMode === "published-edit")
                                : isRecoverableTemporaryDraft(recoveryInvitation);

                            if (isRecoverable) {
                                setRecoveredDraftId(parsed.draftId);
                                setRecoveredDraftTimestamp(parsed.timestamp || null);
                                recoveryDataRef.current = parsed;
                                setShowRecoveryModal(true);
                                setIsLoadingInvitation(false);
                                setIsInitialized(true);
                                return;
                            } else {
                                localStorage.removeItem(scopedRecoveryKey);
                            }
                        } else if (recoveryResponse.status === 401) {
                            setAuthStatus("guest");
                            return;
                        } else if (recoveryResponse.status === 404 || recoveryResponse.status === 409) {
                            localStorage.removeItem(scopedRecoveryKey);
                        }
                    }
                } catch {
                    try {
                        const parsed = JSON.parse(recoveryData);
                        if (!parsed?.draftId) localStorage.removeItem(scopedRecoveryKey);
                    } catch {
                        localStorage.removeItem(scopedRecoveryKey);
                    }
                }
            }

            if (existingId) {
                try {
                    const response = await fetch(`/api/invitations/${existingId}`);
                    if (!response.ok) {
                        if (response.status === 401) setAuthStatus("guest");
                        else {
                            showToast("Could not load invitation.", "error");
                            router.replace("/invitations");
                        }
                        return;
                    }
                    const draft = await response.json();
                    if (!isMounted) return;

                    const normalized = builderDateUtils.normalizeInvitationDate(draft);
                    invitationRef.current = normalized;
                    setInvitation(normalized);
                    latestDraftId.current = normalized.id;
                    setLockInvitationId(normalized.id);
                    setBuilderMode(normalized.status === "published" ? "published-edit" : "draft-edit");

                    const payload = buildSavePayload(normalized);
                    baselinePayloadRef.current = payload;
                    baselineComparablePayloadRef.current = buildComparablePayload(normalized);
                    lastPersistedPayloadRef.current = payload;
                    setSaveStatus("idle");

                    setIsLoadingInvitation(false);
                    setIsInitialized(true);
                } catch {
                    if (isMounted) {
                        showToast("Error connecting to server.", "error");
                    }
                }
                return;
            }

            const defaultInv =
                createFreshBuilderInvitation(
                    templateKey,
                );

            invitationRef.current = defaultInv;
            setInvitation(defaultInv);
            latestDraftId.current = null;
            baselinePayloadRef.current = buildSavePayload(defaultInv);
            baselineComparablePayloadRef.current = buildComparablePayload(defaultInv);
            lastPersistedPayloadRef.current = baselinePayloadRef.current;
            setBuilderMode("new");
            setSaveStatus("idle");
            setIsLoadingInvitation(false);
            setIsInitialized(true);
        }

        void loadBuilder();

        return () => {
            isMounted = false;
        };
    }, [
        existingId,
        initialPreviewSnapshot,
        router,
        scopedRecoveryKey,
        showToast,
        templateKey,
    ]);

    // Programmatic Normalization Baseline Absorber
    // If the template corrects itself (e.g. invalid date clamping), advance the baseline 
    // so we don't accidentally trap the user in an "Unsaved Changes" modal when they haven't edited.
    useEffect(() => {
        if (isInitialized && !hasUserEditedRef.current) {
            const currentPayload = buildSavePayload(invitation);
            if (currentPayload !== baselinePayloadRef.current) {
                baselinePayloadRef.current = currentPayload;
                baselineComparablePayloadRef.current = buildComparablePayload(invitation);
                lastPersistedPayloadRef.current = currentPayload;
            }
        }
    }, [invitation, isInitialized]);

    // 2. Main Coordinator: Save and Sync
    const flushSave = useCallback(async (requestedInvitation = invitationRef.current, force = false): Promise<boolean> => {
        if (isSessionFinalizedRef.current) return false;
        if (latestDraftId.current && !editorLock.credentials) return false;

        if (saveTimerRef.current !== null) {
            window.clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
        }

        // Never start a second POST while the first temporary-draft creation is
        // still running. Wait for that operation, then continue against its ID.
        if (activeSavePromise.current && activeSaveIsCreateRef.current) {
            await activeSavePromise.current;
            if (isSessionFinalizedRef.current) return false;
            requestedInvitation = invitationRef.current;
        }

        const currentPayload = buildSavePayload(requestedInvitation);

        if (currentPayload === lastPersistedPayloadRef.current) {
            setSaveStatus("saved");
            return true;
        }
        if (!force && (builderMode === "draft-edit" || builderMode === "published-edit")) {
            setSaveStatus("dirty");
            return true;
        }

        const errors = validateInvitationFields(requestedInvitation);
        if (Object.keys(errors).length > 0) {
            setValidationErrors(errors);
            setSaveStatus("error");
            return false;
        }

        const requestRevision = ++saveRequestRevisionRef.current;
        const targetId = latestDraftId.current;
        const isNew = !targetId || targetId === "default-draft-placeholder-id";

        setSaveStatus("saving");

        // PATCH requests are replaceable. Initial creation requests are serialized
        // above so a cancelled POST cannot leave an unknown orphan draft.
        pendingSaveController.current?.abort();
        const controller = new AbortController();
        pendingSaveController.current = controller;

        const saveOperation = (async (): Promise<boolean> => {
            try {
                const response = await fetch(isNew ? "/api/invitations" : `/api/invitations/${targetId}`, {
                    method: isNew ? "POST" : "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                        ...(!isNew && editorLock.credentials ? builderLockHeaders(editorLock.credentials) : {}),
                    },
                    body: currentPayload,
                    signal: controller.signal,
                });

                if (
                    controller.signal.aborted ||
                    isSessionFinalizedRef.current ||
                    requestRevision !== saveRequestRevisionRef.current
                ) {
                    return false;
                }

                const result = await response.json();

                if (!response.ok) {
                    if (response.status === 409 && isBuilderConflictCode(result.code)) {
                        cancelPendingEditsForLockLoss();
                        await editorLock.revalidate();
                        return false;
                    }
                    setSaveStatus("error");
                    showToast(formatSaveError(result.error), "error");
                    return false;
                }

                // Capture whether the form changed while this request was in flight
                // before merging server-generated metadata such as id and slug.
                const latestClientPayload = buildSavePayload(invitationRef.current);

                if (isNew) {
                    latestDraftId.current = result.id;
                    setLockInvitationId(result.id);

                    const nextInvitation = {
                        ...invitationRef.current,
                        id: result.id,
                        slug: result.slug,
                    };
                    invitationRef.current = nextInvitation;
                    setInvitation(nextInvitation);

                    // Keep the session mode as "new". This remains an auto-created
                    // temporary draft, so Discard must delete it.
                    localStorage.setItem(
                        scopedRecoveryKey,
                        JSON.stringify({ draftId: result.id, timestamp: Date.now() }),
                    );
                }

                const savedInvitationForCache: InvitationData = {
                    ...result,
                    ...requestedInvitation,

                    id:
                        typeof result.id === "string"
                            ? result.id
                            : targetId ||
                            requestedInvitation.id,

                    slug:
                        typeof result.slug === "string"
                            ? result.slug
                            : requestedInvitation.slug,

                    category:
                        typeof result.category === "string" &&
                            result.category.trim()
                            ? result.category
                            : requestedInvitation.category,

                    templateId:
                        typeof result.templateId ===
                            "string" &&
                            result.templateId.trim()
                            ? result.templateId
                            : requestedInvitation.templateId,
                };

                const persistedPayload =
                    isNew && savedInvitationForCache.slug
                        ? JSON.stringify({
                            ...JSON.parse(currentPayload),
                            slug: savedInvitationForCache.slug,
                        })
                        : currentPayload;

                lastPersistedPayloadRef.current =
                    persistedPayload;
                if (Number.isSafeInteger(result.revision)) {
                    const revision = Number(result.revision);
                    editorLock.updateRevision(revision);
                    const revisionedInvitation = { ...invitationRef.current, revision };
                    invitationRef.current = revisionedInvitation;
                    setInvitation(revisionedInvitation);
                }

                // Finish the complete cache update before
                // navigating back to Invitations.
                mutateInvitationState(
                    globalMutate,
                    savedInvitationForCache,
                    undefined,
                    undefined,
                    false,
                    cache,
                );

                if (currentPayload !== latestClientPayload) {
                    setSaveStatus("dirty");
                    return false;
                }

                setSaveStatus("saved");
                setValidationErrors({});
                return true;
            } catch (error) {
                if (error instanceof Error && error.name === "AbortError") return false;
                if (!isSessionFinalizedRef.current) {
                    setSaveStatus("error");
                    showToast("Save failed. Please try again.", "error");
                }
                return false;
            } finally {
                if (pendingSaveController.current === controller) {
                    pendingSaveController.current = null;
                }
            }
        })();

        activeSavePromise.current = saveOperation;
        activeSaveIsCreateRef.current = isNew;

        try {
            return await saveOperation;
        } finally {
            if (activeSavePromise.current === saveOperation) {
                activeSavePromise.current = null;
                activeSaveIsCreateRef.current = false;
            }
        }
    }, [builderMode, cache, cancelPendingEditsForLockLoss, editorLock, globalMutate, scopedRecoveryKey, showToast]);

    const revertDatabaseToBaseline = useCallback(async () => {
        if (!baselinePayloadRef.current) return;
        try {
            const parsedClean = JSON.parse(baselinePayloadRef.current);
            const normalizedClean = builderDateUtils.normalizeInvitationDate(parsedClean);
            await flushSave(normalizedClean, true);
        } catch (err) {
            console.error("Failed to revert database to baseline:", err);
        }
    }, [flushSave]);

    // Silently restore draft database baseline on tab close if the publish modal is active
    useEffect(() => {
        const handlePageHide = () => {
            if (isPublishModalOpen && builderMode === "draft-edit" && baselinePayloadRef.current) {
                const targetId = latestDraftId.current || existingId;
                if (targetId && targetId !== "default-draft-placeholder-id") {
                    void fetch(`/api/invitations/${targetId}`, {
                        method: "PATCH",
                        keepalive: true,
                        headers: {
                            "Content-Type": "application/json",
                            ...(editorLock.credentials ? builderLockHeaders(editorLock.credentials) : {}),
                        },
                        body: baselinePayloadRef.current,
                    });
                }
            }
        };

        window.addEventListener("pagehide", handlePageHide);
        return () => {
            window.removeEventListener("pagehide", handlePageHide);
        };
    }, [isPublishModalOpen, builderMode, existingId, editorLock.credentials]);

    useEffect(() => {
        if (!isInitialized) return;
        if (editorLock.isReadOnly) return;
        if (!hasUserEditedRef.current) return;
        if (saveStatus !== "dirty") return;

        if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);

        saveTimerRef.current = window.setTimeout(() => {
            void flushSave();
        }, 800);

        return () => {
            if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
        };
    }, [editorLock.isReadOnly, saveStatus, flushSave, isInitialized]);

    // 3. User Input Methods
    const updateField = useCallback((key: string, value: string, source: BuilderUpdateSource = "user") => {
        if (editorLock.isReadOnly) return;
        const previous = invitationRef.current;
        const previousValue = (previous as unknown as Record<string, unknown>)[key];
        if (previousValue === value) return;

        if (key === "eventDate" || key === "eventTime") setDemoCountdownTargetDate(null);

        const next = {
            ...previous,
            [key]: value,
            updatedAt: new Date().toISOString(),
        };

        invitationRef.current = next;
        setInvitation(next);

        const nextErrors = validateInvitationFields(next);
        if (!nextErrors[key as BuilderValidationFieldKey]) {
            setValidationErrors((current) => {
                const updated = { ...current };
                delete updated[key as BuilderValidationFieldKey];
                return updated;
            });
        }

        if (source === "user") {
            setHasUserEdited(true);
            const nextPayload = buildSavePayload(next);
            setSaveStatus(nextPayload === lastPersistedPayloadRef.current ? "saved" : "dirty");
        }
    }, [editorLock.isReadOnly, setHasUserEdited]);

    const updateTheme = useCallback((
        key: keyof InvitationData["theme"],
        value: InvitationData["theme"][keyof InvitationData["theme"]],
    ) => {
        if (editorLock.isReadOnly) return;
        const previous = invitationRef.current;
        if (previous.theme[key] === value) return;

        const next = {
            ...previous,
            theme: { ...previous.theme, [key]: value },
            updatedAt: new Date().toISOString(),
        };

        setHasUserEdited(true);
        invitationRef.current = next;
        setInvitation(next);

        const nextPayload = buildSavePayload(next);
        setSaveStatus(nextPayload === lastPersistedPayloadRef.current ? "saved" : "dirty");
    }, [editorLock.isReadOnly, setHasUserEdited]);

    async function updateMusicFile(file: File | null) {
        if (editorLock.isReadOnly || !editorLock.credentials) return;
        if (!file) {
            updateField("musicUrl", "");
            return;
        }

        setIsUploadingMusic(true);
        try {
            const formData = new FormData();
            formData.set("invitationId", latestDraftId.current || invitationRef.current.id);
            formData.set("kind", "music");
            formData.set("file", file);
            formData.set("editorSessionId", editorLock.credentials.editorSessionId);
            formData.set("lockGeneration", String(editorLock.credentials.lockGeneration));
            formData.set("revision", String(editorLock.credentials.revision));

            const response = await fetch("/api/media", { method: "POST", body: formData });
            const result = await response.json();

            if (!response.ok) {
                showToast(result.error || "Music upload failed", "error");
                return;
            }

            updateField("musicUrl", result.url);
        } finally {
            setIsUploadingMusic(false);
        }
    }

    // 4. Session Teardown
    const finalizeSession = useCallback((options?: { preserveRecovery?: boolean }) => {
        if (isSessionFinalizedRef.current) return;

        isSessionFinalizedRef.current = true;
        isIntentionalNavigationRef.current = true;
        requiresExitDecisionRef.current = false;
        saveRequestRevisionRef.current += 1;
        editorLock.release();

        if (!options?.preserveRecovery) {
            localStorage.removeItem(scopedRecoveryKey);
        }
        sessionStorage.removeItem(scopedPreviewKey);
        sessionStorage.removeItem(builderLocalPreviewKey);
        sessionStorage.removeItem(`vilique-builder:preview:${templateKey}`);
        if (latestDraftId.current) {
            sessionStorage.removeItem(`vilique-builder:preview:${latestDraftId.current}`);
        }

        pendingSaveController.current?.abort();
        pendingSaveController.current = null;
        activeSavePromise.current = null;
        activeSaveIsCreateRef.current = false;

        if (saveTimerRef.current !== null) {
            window.clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
        }
    }, [editorLock, scopedRecoveryKey, scopedPreviewKey, templateKey]);

    const navigateOut = useCallback((
        destination: string,
        options?: { preserveRecovery?: boolean },
    ) => {
        if (navigationCommittedRef.current) return;
        navigationCommittedRef.current = true;

        finalizeSession(options);
        router.replace(destination);
    }, [finalizeSession, router]);

    const hasMeaningfulChanges = useCallback(() => {
        if (!isInitialized || isSessionFinalizedRef.current) return false;
        if (requiresExitDecisionRef.current) {
            return true;
        }

        if (!hasUserEditedRef.current) {
            return false;
        }
        return buildComparablePayload(invitationRef.current) !== baselineComparablePayloadRef.current;
    }, [isInitialized]);

    const discardAndLeave = useCallback(async (destination = builderBackTarget) => {
        if (isSessionFinalizedRef.current || navigationCommittedRef.current) return;

        if (saveTimerRef.current !== null) {
            window.clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
        }

        // If the first draft POST is already running, let it finish so its ID is
        // known and can be deleted. Aborting that POST could create an orphan record
        // server-side without giving the client the resulting ID.
        if (activeSavePromise.current && activeSaveIsCreateRef.current) {
            await activeSavePromise.current;
        }

        // Invalidate every other response from the editing generation before cleanup.
        saveRequestRevisionRef.current += 1;
        pendingSaveController.current?.abort();
        pendingSaveController.current = null;

        const currentId = latestDraftId.current;

        // View-only sessions must never mutate a draft still owned by another
        // editor. Keep the recovery marker for temporary drafts so the user can
        // return after the active lease is released or expires.
        if (currentId && (!editorLock.credentials || editorLock.isReadOnly)) {
            navigateOut(destination, {
                preserveRecovery: builderMode === "new",
            });
            return;
        }

        if (builderMode === "new" && currentId && currentId !== "default-draft-placeholder-id") {
            const response = await fetch(`/api/invitations/${currentId}`, {
                method: "DELETE",
                headers: editorLock.credentials ? builderLockHeaders(editorLock.credentials) : {},
            });
            if (!response.ok && response.status !== 404) {
                throw new Error("Could not discard the temporary draft.");
            }
        } else if (
            builderMode === "draft-edit" &&
            currentId &&
            lastPersistedPayloadRef.current !==
            baselinePayloadRef.current
        ) {
            const discardedEditedInvitation =
                invitationRef.current;

            const response = await fetch(
                `/api/invitations/${currentId}`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type":
                            "application/json",
                        ...(editorLock.credentials ? builderLockHeaders(editorLock.credentials) : {}),
                    },
                    body: baselinePayloadRef.current,
                },
            );

            const result = await response
                .json()
                .catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    result.error ||
                    "Could not restore the original draft.",
                );
            }

            const originalPayload = JSON.parse(
                baselinePayloadRef.current,
            ) as Partial<InvitationData>;

            const restoredInvitationForCache: InvitationData =
            {
                ...discardedEditedInvitation,
                ...originalPayload,
                ...result,
                id: currentId,
                slug:
                    typeof result.slug === "string"
                        ? result.slug
                        : discardedEditedInvitation.slug,
                category:
                    typeof result.category ===
                        "string" &&
                        result.category.trim()
                        ? result.category
                        : discardedEditedInvitation.category,
                templateId:
                    typeof result.templateId ===
                        "string" &&
                        result.templateId.trim()
                        ? result.templateId
                        : discardedEditedInvitation.templateId,
                status: "draft",
                updatedAt:
                    typeof result.updatedAt ===
                        "string"
                        ? result.updatedAt
                        : typeof result.updated_at ===
                            "string"
                            ? result.updated_at
                            : new Date().toISOString(),
            };
            invitationRef.current =
                restoredInvitationForCache;
            mutateInvitationState(
                globalMutate,
                restoredInvitationForCache,
                discardedEditedInvitation,
                undefined,
                true,
                cache,
            );
        }

        navigateOut(destination);
    }, [
        builderBackTarget,
        builderMode,
        cache,
        editorLock.credentials,
        editorLock.isReadOnly,
        globalMutate,
        navigateOut,
    ]);

    const requestBuilderLeave = useCallback(() => {
        if (
            !isInitialized ||
            leaveModalOpen ||
            navigationCommittedRef.current ||
            isSessionFinalizedRef.current
        ) return;

        if (hasMeaningfulChanges()) {
            setLeaveModalOpen(true);
            return;
        }

        // No confirmation is required. If the user previously edited and returned
        // exactly to the baseline, silently remove/revert any autosaved session data.
        void discardAndLeave().catch((error) => {
            console.error("Builder leave cleanup failed", error);
            showToast("Could not leave the builder safely. Please try again.", "error");
        });
    }, [discardAndLeave, hasMeaningfulChanges, isInitialized, leaveModalOpen, showToast]);

    // 5. Back & Unload Guards
    useEffect(() => {
        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            if (!hasMeaningfulChanges()) return;
            event.preventDefault();
            event.returnValue = "";
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [hasMeaningfulChanges]);

    useEffect(() => {
        if (!isInitialized) return;

        const trapState = { ...(window.history.state ?? {}), viliqueBuilderTrap: true };
        if (!window.history.state?.viliqueBuilderTrap) {
            window.history.pushState(trapState, "", window.location.href);
        }

        const handlePopState = () => {
            if (isIntentionalNavigationRef.current || navigationCommittedRef.current) return;

            // Restore the builder entry immediately so Next.js cannot render the
            // destination before the user has confirmed the leave action.
            window.history.pushState(trapState, "", window.location.href);
            requestBuilderLeave();
        };

        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, [isInitialized, requestBuilderLeave]);

    // 6. Preview Sync
    function saveAndPreview() {
        if (isPreviewing || isPublishing) return;

        setIsPreviewing(true);

        const currentInvitation = invitationRef.current;
        const targetId = latestDraftId.current;
        const hasPersistedId = Boolean(targetId)
            && targetId !== "default-draft-placeholder-id";

        // Preview returns to this exact Builder session. The final Builder exit
        // target remains separate and is used only after Save/Discard/no-change exit.
        const returnParams = new URLSearchParams(searchParams.toString());
        returnParams.set("template", currentInvitation.templateId || templateKey);
        returnParams.set("returnTo", builderBackTarget);
        returnParams.set("previewReturn", "1");
        if (hasPersistedId && targetId) returnParams.set("id", targetId);
        else returnParams.delete("id");

        const builderReturnUrl = `/builder?${returnParams.toString()}`;
        const snapshot: BuilderPreviewSnapshot & Record<string, unknown> = {
            source: "builder-session",
            invitation: currentInvitation,
            invitationId: hasPersistedId && targetId ? targetId : null,
            templateId: currentInvitation.templateId || templateKey,
            builderReturnUrl,
            builderExitTarget: builderBackTarget,
            backLabel: "Editor",
            // Keep backTarget for the currently installed Preview component.
            // It must point to Builder, never Invitations.
            backTarget: builderReturnUrl,
            baselinePayload: baselinePayloadRef.current,
            baselineComparablePayload: baselineComparablePayloadRef.current,
            lastPersistedPayload: lastPersistedPayloadRef.current,
            hasUserEdited: hasUserEditedRef.current,
            requiresExitDecision: requiresExitDecisionRef.current,
            builderMode,
            saveStatus,
            createdAt: Date.now(),
            // Backward-compatible aliases used by older Builder restore code.
            _baselinePayload: baselinePayloadRef.current,
            _baselineComparablePayload: baselineComparablePayloadRef.current,
            _lastPersistedPayload: lastPersistedPayloadRef.current,
            _hasUserEdited: hasUserEditedRef.current,
            _builderMode: builderMode,
            _saveStatus: saveStatus,
        };
        const payload = JSON.stringify(snapshot);

        sessionStorage.setItem(builderLocalPreviewKey, payload);
        sessionStorage.setItem(scopedPreviewKey, payload);
        sessionStorage.setItem(
            `vilique-builder:preview:${hasPersistedId && targetId ? targetId : currentInvitation.templateId || templateKey}`,
            payload,
        );

        isIntentionalNavigationRef.current = true;

        const previewParams = new URLSearchParams({
            local: "1",
            template: currentInvitation.templateId || templateKey,
            // This is also provided as a fallback for Preview implementations
            // that read the destination from the URL instead of sessionStorage.
            returnTo: builderReturnUrl,
        });
        if (hasPersistedId && targetId) previewParams.set("id", targetId);

        router.replace(
            `/builder/preview?${previewParams.toString()}`,
            {
                scroll: false,
            },
        );
    }

    // 7. Core Leave Modals: Save Draft & Discard
    async function handleLeaveModalSave() {
        if (isSavingDraftAndLeaving) return false;

        setIsSavingDraftAndLeaving(true);

        const loaderStartedAt = performance.now();
        const minimumLoaderDuration = 350;

        try {
            // Wait until React renders and the browser paints the loader.
            await new Promise<void>((resolve) => {
                window.requestAnimationFrame(() => {
                    window.requestAnimationFrame(() => resolve());
                });
            });

            const success = await flushSave(
                invitationRef.current,
                true,
            );

            if (!success) {
                setIsSavingDraftAndLeaving(false);
                return false;
            }

            // Keep the loader visible long enough to be noticeable,
            // even when the draft was already autosaved.
            const elapsed = performance.now() - loaderStartedAt;
            const remaining = minimumLoaderDuration - elapsed;

            if (remaining > 0) {
                await new Promise<void>((resolve) => {
                    window.setTimeout(resolve, remaining);
                });
            }

            showToast(
                builderMode === "new"
                    ? "Draft saved successfully."
                    : "Changes saved successfully.",
                "success",
            );

            navigateOut(builderBackTarget);

            return true;
        } catch (error) {
            console.error("Save Draft failed", error);

            setIsSavingDraftAndLeaving(false);

            showToast(
                "Could not save your draft. Please try again.",
                "error",
            );

            return false;
        }
    }

    async function handleDiscard() {
        try {
            await discardAndLeave();
        } catch (error) {
            showToast(
                error instanceof Error ? error.message : "Cleanup failed. Please try again.",
                "error",
            );
            throw error;
        }
    }

    // 8. Publish Actions
    async function handlePublishInvitation() {
        if (
            !canPublishOrUpdate || editorLock.isReadOnly ||
            isPublishing ||
            isPreviewing
        ) {
            return;
        }

        setIsPublishing(true);
        const currentInvitation = invitationRef.current;
        publishPreviousInvitationRef.current = {
            ...currentInvitation,
            status: "draft",
            lifecycleStatus: "draft",
            eventStatus: "draft",
        };

        const errors = validateInvitationFields(currentInvitation);
        if (Object.keys(errors).length > 0) {
            setValidationErrors(errors);
            const firstField = Object.keys(errors)[0] as BuilderValidationFieldKey;
            const tab = requiredFieldTabs[firstField];
            if (tab) setActiveTab(tab);
            setMobileEditorOpen(true);
            showToast("Please fix highlighted fields before continuing.", "error");
            setIsPublishing(false);
            return;
        }

        const success = await flushSave(
            currentInvitation,
            true,
        );

        setIsPublishing(false);

        if (!success) {
            return;
        }

        setIsPublishModalOpen(true);
    }

    async function handleUpdateInvitation() {
        if (
            builderMode !== "published-edit" ||
            editorLock.isReadOnly ||
            !canPublishOrUpdate ||
            isPublishing ||
            isPreviewing
        ) {
            return;
        }

        setIsPublishing(true);

        const currentInvitation =
            invitationRef.current;

        const errors =
            validateInvitationFields(
                currentInvitation,
            );

        if (Object.keys(errors).length > 0) {
            setValidationErrors(errors);

            const firstField =
                Object.keys(
                    errors,
                )[0] as BuilderValidationFieldKey;

            const tab =
                requiredFieldTabs[firstField];

            if (tab) {
                setActiveTab(tab);
            }

            setMobileEditorOpen(true);

            showToast(
                "Please fix highlighted fields before continuing.",
                "error",
            );

            setIsPublishing(false);
            return;
        }

        const success = await flushSave(
            currentInvitation,
            true,
        );

        if (!success) {
            setIsPublishing(false);
            return;
        }

        hasUserEditedRef.current = false;
        requiresExitDecisionRef.current = false;

        setSaveStatus("saved");

        showToast(
            "Invitation updated successfully.",
            "success",
        );
        navigateOut(builderBackTarget);
    }

    const saveStatusLabel =
        getBuilderSaveStatusLabel({
            saveStatus,
            builderMode,
        });

    const isPublishedEdit =
        builderMode === "published-edit" ||
        invitation.status === "published";

    const isFreshNewBuilder =
        builderMode === "new" &&
        invitation.id === "default-draft-placeholder-id" &&
        !hasUserEditedState &&
        !initialPreviewSnapshot;

    const hasMeaningfulEdits =
        hasUserEditedState &&
        buildComparablePayload(invitation) !==
        baselineComparablePayloadState;

    const canPublishOrUpdate = !editorLock.isReadOnly && (isPublishedEdit
        ? hasMeaningfulEdits
        : isFreshNewBuilder
        ? hasMeaningfulEdits
        : true);

    // 9. Recovery Handlers
    async function handleRecoveryContinue() {
        if (!recoveredDraftId) return;
        setIsLoadingInvitation(true);
        setShowRecoveryModal(false);
        try {
            const res = await fetch(`/api/invitations/${recoveredDraftId}`);
            if (res.ok) {
                const draft = await res.json();
                let normalized = builderDateUtils.normalizeInvitationDate(draft);
                const payload = buildSavePayload(normalized);

                if (recoveryDataRef.current && (recoveryDataRef.current.builderMode === "draft-edit" || recoveryDataRef.current.builderMode === "published-edit") && recoveryDataRef.current.baselinePayload) {
                    if (recoveryDataRef.current.recoveredPayload) {
                        const parsedRecovered = JSON.parse(recoveryDataRef.current.recoveredPayload);
                        normalized = builderDateUtils.normalizeInvitationDate(parsedRecovered);
                    }
                    const cleanInvitation = JSON.parse(recoveryDataRef.current.baselinePayload);
                    baselinePayloadRef.current = recoveryDataRef.current.baselinePayload;
                    baselineComparablePayloadRef.current = buildComparablePayload(cleanInvitation);
                    setBuilderMode(recoveryDataRef.current.builderMode);
                    hasUserEditedRef.current = true;
                    setHasUserEditedState(true);
                } else {
                    baselinePayloadRef.current = payload;
                    baselineComparablePayloadRef.current = buildComparablePayload(normalized);
                    setBuilderMode("new");
                }

                invitationRef.current = normalized;
                setInvitation(normalized);
                latestDraftId.current = normalized.id;
                setLockInvitationId(normalized.id);
                lastPersistedPayloadRef.current = payload;
                requiresExitDecisionRef.current = true;
            } else if (res.status === 401) {
                setAuthStatus("guest");
            } else if (res.status === 404 || res.status === 409) {
                await handleRecoveryStartFresh();
                return;
            } else {
                showToast("Failed to recover draft", "error");
            }
        } catch {
            showToast("Failed to recover draft", "error");
        }
        setIsLoadingInvitation(false);
        setIsInitialized(true);
    }

    async function handleRecoveryDiscard() {
        const recoveryData = recoveryDataRef.current;
        if (recoveryData && (recoveryData.builderMode === "draft-edit" || recoveryData.builderMode === "published-edit")) {
            setIsLoadingInvitation(true);
            setShowRecoveryModal(false);
            try {
                const res = await fetch(`/api/invitations/${recoveredDraftId}`);
                if (res.ok) {
                    const draft = await res.json();
                    const normalized = builderDateUtils.normalizeInvitationDate(draft);
                    
                    setLockInvitationId(normalized.id);
                    latestDraftId.current = normalized.id;
                    setBuilderMode(recoveryData.builderMode);

                    invitationRef.current = normalized;
                    setInvitation(normalized);
                    const payload = buildSavePayload(normalized);
                    baselinePayloadRef.current = payload;
                    baselineComparablePayloadRef.current = buildComparablePayload(normalized);
                    lastPersistedPayloadRef.current = payload;
                    
                    hasUserEditedRef.current = false;
                    setHasUserEditedState(false);
                }
            } catch {
                showToast("Failed to discard changes", "error");
            }
            localStorage.removeItem(scopedRecoveryKey);
            setRecoveredDraftId(null);
            setIsLoadingInvitation(false);
            setIsInitialized(true);
        } else {
            await handleRecoveryStartFresh();
        }
    }

    async function handleRecoveryStartFresh() {
        if (recoveredDraftId) {
            try {
                const response = await fetch(
                    `/api/invitations/${recoveredDraftId}`,
                    {
                        method: "DELETE",
                        headers: editorLock.credentials ? builderLockHeaders(editorLock.credentials) : {},
                    },
                );

                if (
                    !response.ok &&
                    response.status !== 404
                ) {
                    showToast(
                        "Could not discard the recovered draft. Please try again.",
                        "error",
                    );

                    return;
                }
            } catch {
                showToast(
                    "Could not discard the recovered draft. Please try again.",
                    "error",
                );

                return;
            }
        }
        localStorage.removeItem(scopedRecoveryKey);
        sessionStorage.removeItem(scopedPreviewKey);
        sessionStorage.removeItem(builderLocalPreviewKey);
        sessionStorage.removeItem(`vilique-builder:preview:${templateKey}`);
        if (latestDraftId.current) {
            sessionStorage.removeItem(`vilique-builder:preview:${latestDraftId.current}`);
        }

        const freshInvitation =
            createFreshBuilderInvitation(
                templateKey,
            );
        const payload = buildSavePayload(freshInvitation);

        invitationRef.current = freshInvitation;
        setInvitation(freshInvitation);
        latestDraftId.current = null;
        setLockInvitationId(null);
        baselinePayloadRef.current = payload;
        baselineComparablePayloadRef.current = buildComparablePayload(freshInvitation);
        lastPersistedPayloadRef.current = payload;
        hasUserEditedRef.current = false;
        requiresExitDecisionRef.current = false;
        setSaveStatus("idle");
        setRecoveredDraftId(null);
        setShowRecoveryModal(false);
        setBuilderMode("new");
        setIsInitialized(true);
    }

    if (isLoadingInvitation) {
        return <BuilderLoadingState />;
    }

    if (authStatus === "guest") {
        return (
            <BuilderAuthRequiredState
                templateKey={templateKey}
            />
        );
    }


    function handlePublishSuccess(
        updatedInvitation: PublishModalSuccessPayload,
    ) {
        if (updatedInvitation.status !== "published") return;

        editorLock.markPublished();
        finalizeSession();
        const previousDraft: InvitationData = publishPreviousInvitationRef.current || {
            ...invitationRef.current,
            status: "draft" as const,
            lifecycleStatus: "draft" as const,
            eventStatus: "draft" as const,
        };

        const publishedAtTime =
            updatedInvitation.published_at ||
            previousDraft.publishedAt ||
            new Date().toISOString();

        const publishedInvitation: InvitationData = {
            ...previousDraft,
            id: previousDraft.id,
            status: (updatedInvitation.status || "published") as NonNullable<InvitationData["status"]>,
            slug: updatedInvitation.slug || previousDraft.slug,
            category: previousDraft.category,
            templateId: previousDraft.templateId,
            title: previousDraft.title,
            primaryName: previousDraft.primaryName,
            secondaryName: previousDraft.secondaryName,
            eventDate: previousDraft.eventDate,
            eventTime: previousDraft.eventTime,
            venueName: previousDraft.venueName,
            venueAddress: previousDraft.venueAddress,
            mapLink: previousDraft.mapLink,
            phone: previousDraft.phone,
            secondaryPhone: previousDraft.secondaryPhone,
            whatsapp: previousDraft.whatsapp,
            message: previousDraft.message,
            musicUrl: previousDraft.musicUrl,
            coverImageUrl: previousDraft.coverImageUrl,
            galleryUrls: previousDraft.galleryUrls,
            theme: previousDraft.theme,
            sections: previousDraft.sections,
            publishedAt: publishedAtTime,
            firstPublishedAt: previousDraft.firstPublishedAt || publishedAtTime,
            createdAt: previousDraft.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lifecycleStatus: "published",
            eventStatus: "published",
            paymentStatus: previousDraft.paymentStatus || "paid",
        };

        mutateInvitationState(
            globalMutate,
            publishedInvitation,
            previousDraft,
            undefined,
            true,
            cache,
        );

        publishedInvitationForNavigationRef.current = publishedInvitation;
        invitationRef.current = publishedInvitation;
        setInvitation(publishedInvitation);

        setBuilderMode("published-edit");
        setSaveStatus("saved");

        const postPublishPayload = buildSavePayload(publishedInvitation);
        baselinePayloadRef.current = postPublishPayload;
        baselineComparablePayloadRef.current = buildComparablePayload(publishedInvitation);
        lastPersistedPayloadRef.current = postPublishPayload;
        hasUserEditedRef.current = false;

        setIsPublishModalOpen(false);

        setPublishSuccessDetails({
            slug: updatedInvitation.slug,
            publishedAt: updatedInvitation.published_at,
        });
    }

    const selectedTemplate = templates.find((item) => item.id === invitation.templateId);

    return (
        <main className="builderShell">
            {builderMode !== "new" && (
                <BuilderLockBanner
                    isOpen={!!((editorLock.mode === "readonly" || editorLock.mode === "lost") && !lockOverlayDismissed || isTakingOverLock)}
                    lost={editorLock.mode === "lost"}
                    takeOverBusy={isTakingOverLock}
                    onTakeOver={() => {
                        setLockOverlayDismissed(false);
                        setIsTakingOverLock(true);
                        void editorLock.takeOver().finally(() => setIsTakingOverLock(false));
                    }}
                    onClose={() => navigateOut(builderBackTarget)}
                />
            )}
            <BuilderTopbar
                title={
                    selectedTemplate?.name ||
                    "Custom Template"
                }
                saveStatusLabel={saveStatusLabel}
                saveStatus={saveStatus}
                isPreviewing={isPreviewing}
                isPublishing={isPublishing}
                isPublishedEdit={isPublishedEdit}
                isPublishDisabled={
                    !canPublishOrUpdate
                }
                onBack={requestBuilderLeave}
                onPreview={saveAndPreview}
                onPublish={
                    isPublishedEdit
                        ? handleUpdateInvitation
                        : handlePublishInvitation
                }
            />
            <section className={`builderWorkspace${editorCollapsed ? " editorCollapsed" : ""}`}>
                <DesktopEditorPanel
                    activeTab={activeTab}
                    invitation={invitation}
                    errors={validationErrors}
                    isUploadingMusic={
                        isUploadingMusic
                    }
                    isCollapsed={editorCollapsed}
                    isReadOnly={editorLock.isReadOnly}
                    onTabChange={(tab) => {
                        setActiveTab(tab);
                        setEditorCollapsed(false);
                    }}
                    updateField={updateField}
                    updateTheme={updateTheme}
                    updateMusicFile={
                        updateMusicFile
                    }
                    onToggleCollapse={() =>
                        setEditorCollapsed(
                            (collapsed) => !collapsed,
                        )
                    }
                />
                <BuilderLivePreview
                    invitation={invitation}
                    previewScreen={previewScreen}
                    previewDeviceMode={
                        previewDeviceMode
                    }
                    previewScrolledToBottom={
                        previewScrolledToBottom
                    }
                    previewViewportRef={
                        previewViewportRef
                    }
                    demoCountdownTargetDate={
                        demoCountdownTargetDate
                    }
                    onScreenChange={
                        setPreviewScreen
                    }
                    onDeviceModeChange={
                        setPreviewDeviceMode
                    }
                />
            </section>

            <MobileEditorTrigger
                hidden={mobileEditorOpen}
                onClick={() =>
                    setMobileEditorOpen(true)
                }
            />

            <MobileEditorSheet
                isOpen={mobileEditorOpen}
                activeTab={activeTab}
                invitation={invitation}
                errors={validationErrors}
                isUploadingMusic={
                    isUploadingMusic
                }
                isReadOnly={editorLock.isReadOnly}
                setActiveTab={setActiveTab}
                updateField={updateField}
                updateTheme={updateTheme}
                updateMusicFile={
                    updateMusicFile
                }
                onClose={() =>
                    setMobileEditorOpen(false)
                }
            />

            <BuilderBottomBar
                isPreviewing={isPreviewing}
                isPublishing={isPublishing}
                isPublishedEdit={isPublishedEdit}
                onEdit={() =>
                    setMobileEditorOpen(true)
                }
                isPublishDisabled={!canPublishOrUpdate}
                onPreview={saveAndPreview}
                onPublish={
                    isPublishedEdit
                        ? handleUpdateInvitation
                        : handlePublishInvitation
                }
            />

            {showRecoveryModal && (
                <RecoveryModal
                    timestamp={recoveredDraftTimestamp}
                    onContinueEditing={handleRecoveryContinue}
                    onDiscard={handleRecoveryDiscard}
                />
            )}

            <BuilderModals
                builderMode={builderMode}
                invitation={invitation}
                editorLock={editorLock.credentials}
                leaveModalOpen={
                    leaveModalOpen
                }
                isSavingDraftAndLeaving={
                    isSavingDraftAndLeaving
                }
                isPublishModalOpen={
                    isPublishModalOpen
                }
                publishSuccessDetails={
                    publishSuccessDetails
                }
                onLeaveSave={
                    handleLeaveModalSave
                }
                onLeaveDiscard={handleDiscard}
                onLeaveCancel={() =>
                    setLeaveModalOpen(false)
                }
                onPublishClose={() => {
                    setIsPublishModalOpen(false);
                    if (builderMode === "draft-edit") {
                        void revertDatabaseToBaseline();
                    }
                }}
                onPublishSuccess={
                    handlePublishSuccess
                }
                onViewInvitations={() => {
                    navigateOut("/invitations?status=upcoming");
                }}
            />
        </main>
    );
}
