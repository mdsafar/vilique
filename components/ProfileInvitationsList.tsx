"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    CalendarDays,
    Clock,
    RefreshCw,
    Eye,
    BarChart3,
    PencilLine,
    Trash2,
    Search,
    X,
    Filter,
    ExternalLink,
    Copy,
    Check,
    Loader2,
    Power,
    AlertTriangle,
    FileText,
    CalendarCheck,
    Sparkles,
    CheckCircle2,
    WifiOff,
    Wifi,
    Lock,
} from "lucide-react";
import { deleteInvitation } from "@/app/(app)/profile/actions";
import { InvitationData } from "@/types/invitation";
import { getPublicInvitationUrl } from "@/lib/config/site";
import { getEventPhase, isInvitationCompleted } from "@/lib/lifecycle";
import ConfirmModal from "./ConfirmModal";
import { useToast } from "./Toast";
import { useNavigationState } from "./NavigationStateProvider";
import { useSWRConfig } from "swr";

interface DashboardData {
    profile: {
        email: string;
        name: string;
        avatarUrl: string | null;
    } | null;
    invitations: InvitationData[];
    published: number;
    drafts: number;
    views: number;
    rsvps: number;
    invitationStats: Record<string, { rsvps: number; views: number; acceptsRsvps?: boolean }>;
    totalSpent: number;
}

interface ProfileInvitationsListProps {
    initialInvitations: InvitationData[];
    invitationStats: Record<string, { rsvps: number; views: number; acceptsRsvps?: boolean }>;
}

export default function ProfileInvitationsList({
    initialInvitations,
    invitationStats,
}: ProfileInvitationsListProps) {
    const {
        invitationsSearch: searchTerm,
        setInvitationsSearch: setSearchTerm,
        invitationsFilter: statusFilter,
        setInvitationsFilter: setStatusFilter,
    } = useNavigationState();

    const filteredInvitations = initialInvitations.filter((item) => {
        const lifecycleStatus = getInvitationLifecycleStatus(item);
        const matchesStatus = statusFilter === "all" ||
            lifecycleStatus === statusFilter ||
            (statusFilter === "upcoming" && lifecycleStatus === "live_today");

        const combinedText = `
            ${item.title}
            ${item.primaryName}
            ${item.secondaryName || ""}
            ${item.category}
        `.toLowerCase();

        return matchesStatus && combinedText.includes(searchTerm.toLowerCase());
    });

    const lifecycleCounts = initialInvitations.reduce(
        (counts, item) => {
            const lifecycleStatus = getInvitationLifecycleStatus(item);
            if (lifecycleStatus === "draft") counts.draft += 1;
            if (lifecycleStatus === "completed") counts.completed += 1;
            if (lifecycleStatus === "upcoming" || lifecycleStatus === "live_today") counts.upcoming += 1;
            return counts;
        },
        { upcoming: 0, completed: 0, draft: 0 }
    );

    const handleClearSearch = () => setSearchTerm("");
    const handleResetAll = () => {
        setSearchTerm("");
        setStatusFilter("all");
    };

    return (
        <>
            <header className="profileControls">
                <div>
                    <h2>Your invitations</h2>
                    <p>Manage and track all your invitation websites</p>
                </div>

                <div className="profileSearchWrapper">
                    <Search className="searchIcon" size={18} aria-hidden="true" />
                    <input
                        type="text"
                        placeholder="Search by title, couple, or event type..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="profileSearchInput"
                    />
                    {searchTerm && (
                        <button
                            type="button"
                            onClick={handleClearSearch}
                            className="clearSearchBtn"
                            aria-label="Clear search query"
                        >
                            <X size={15} />
                        </button>
                    )}
                </div>
            </header>

            <div className="profileInvitationsContainer">
                <nav className="profileFilterTabs" aria-label="Invitation filters">
                    <button
                        type="button"
                        className={`filterTabBtn ${statusFilter === "all" ? "active" : ""}`}
                        onClick={() => setStatusFilter("all")}
                    >
                        All <span>{initialInvitations.length}</span>
                    </button>
                    <button
                        type="button"
                        className={`filterTabBtn ${statusFilter === "upcoming" ? "active" : ""}`}
                        onClick={() => setStatusFilter("upcoming")}
                    >
                        Upcoming <span className="pub">{lifecycleCounts.upcoming}</span>
                    </button>
                    <button
                        type="button"
                        className={`filterTabBtn ${statusFilter === "completed" ? "active" : ""}`}
                        onClick={() => setStatusFilter("completed")}
                    >
                        Completed <span>{lifecycleCounts.completed}</span>
                    </button>
                    <button
                        type="button"
                        className={`filterTabBtn ${statusFilter === "draft" ? "active" : ""}`}
                        onClick={() => setStatusFilter("draft")}
                    >
                        Drafts <span className="drf">{lifecycleCounts.draft}</span>
                    </button>
                </nav>

            {filteredInvitations.length ? (
                <div className="profileInvitationList">
                    {filteredInvitations.map((invitation) => (
                        <InvitationRow
                            invitation={invitation}
                            key={invitation.id}
                            stats={invitationStats[invitation.id] || { rsvps: 0, views: 0, acceptsRsvps: false }}
                        />
                    ))}
                </div>
            ) : (
                <div className="profileEmptyState">
                    {searchTerm || statusFilter !== "all" ? (
                        <>
                            <div className="emptyStateIcon">
                                <Filter size={32} />
                            </div>
                            <h3>No results found</h3>
                            <p>No invitations match your active search or filters.</p>
                            <button
                                type="button"
                                onClick={handleResetAll}
                                className="resetFilterBtn"
                            >
                                Reset Search & Filters
                            </button>
                        </>
                    ) : (
                        <>
                            <h3>Choose a template to begin</h3>
                            <p>Pick a template to publish your first invite.</p>
                            <Link href="/templates">Browse templates</Link>
                        </>
                    )}
                </div>
            )}
        </div>
        </>
    );
}

function InvitationRow({
    invitation,
}: {
    invitation: InvitationData;
    stats: { rsvps: number; views: number; acceptsRsvps?: boolean };
}) {
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isOfflineOpen, setIsOfflineOpen] = useState(false);
    const [isOnlineOpen, setIsOnlineOpen] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isTakingOffline, setIsTakingOffline] = useState(false);
    const [isMakingOnline, setIsMakingOnline] = useState(false);
    const router = useRouter();
    const { showToast } = useToast();
    const { mutate } = useSWRConfig();

    const lifecycleStatus = getInvitationLifecycleStatus(invitation);
    const isDraft = lifecycleStatus === "draft";
    const isUpcoming = lifecycleStatus === "upcoming";
    const isLiveToday = lifecycleStatus === "live_today";
    const isCompleted = lifecycleStatus === "completed";
    const isOffline = lifecycleStatus === "offline";
    const isPublic = isUpcoming || isLiveToday || isCompleted;
    const hasAnalyticsAccess = Boolean(invitation.firstPublishedAt || invitation.publishedAt);

    const isSample = invitation.id.startsWith("sample-");
    const editHref = isSample ? "/templates" : `/builder?id=${invitation.id}&from=invitations`;
    const analyticsHref = `/invitations/${invitation.id}/analytics`;
    const previewHref = isSample
        ? "/templates"
        : isPublic
            ? `/i/${invitation.slug}`
            : `/builder/preview?id=${invitation.id}&from=invitations`;
    const publicUrl = getPublicInvitationUrl(invitation.slug);

    const handleEdit = () => {
        setIsEditing(true);
        router.push(editHref);
    };

    async function handleDeleteConfirm() {
        setIsDeleting(true);
        const originalData = await mutate("/api/profile/dashboard");

        mutate("/api/profile/dashboard", (current?: DashboardData) => {
            if (!current) return current;
            const updatedInvitations = current.invitations.filter((item) => item.id !== invitation.id);
            const isDraftState = invitation.status === "draft";
            return {
                ...current,
                invitations: updatedInvitations,
                published: current.published - (isDraftState ? 0 : 1),
                drafts: current.drafts - (isDraftState ? 1 : 0),
            };
        }, { revalidate: false });

        try {
            const formData = new FormData();
            formData.append("id", invitation.id);
            const result = await deleteInvitation(formData);
            if (!result?.ok) {
                showToast(result?.error || "Failed to delete invitation", "error");
                mutate("/api/profile/dashboard", originalData, { revalidate: false });
                return;
            }
            showToast(isDraft ? "Draft deleted." : "Invitation deleted.", "success");
            mutate("/api/profile/dashboard");
        } catch (error) {
            showToast(error instanceof Error ? error.message : "Failed to delete invitation", "error");
            mutate("/api/profile/dashboard", originalData, { revalidate: false });
        } finally {
            setIsDeleting(false);
            setIsDeleteOpen(false);
        }
    }

    function handleTakeOfflineClick() {
        setIsOfflineOpen(true);
    }

    async function handleTakeOfflineConfirm() {
        if (isTakingOffline) return;
        setIsTakingOffline(true);
        const originalData = await mutate("/api/profile/dashboard");

        mutate("/api/profile/dashboard", (current?: DashboardData) => {
            if (!current) return current;
            const updatedInvitations = current.invitations.map((item) => {
                if (item.id === invitation.id) {
                    return {
                        ...item,
                        status: "draft" as const,
                        lifecycleStatus: "unpublished" as const,
                        eventStatus: "unpublished" as const,
                    };
                }
                return item;
            });
            return {
                ...current,
                invitations: updatedInvitations,
                published: current.published - 1,
                drafts: current.drafts + 1,
            };
        }, { revalidate: false });

        try {
            const response = await fetch(`/api/invitations/${invitation.id}/unpublish`, {
                method: "POST",
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
                showToast(result.error || "Unable to take invitation offline.", "error");
                mutate("/api/profile/dashboard", originalData, { revalidate: false });
                return;
            }
            showToast("Invitation taken offline.", "success");
            mutate("/api/profile/dashboard");
        } catch {
            showToast("Unable to take invitation offline.", "error");
            mutate("/api/profile/dashboard", originalData, { revalidate: false });
        } finally {
            setIsTakingOffline(false);
            setIsOfflineOpen(false);
        }
    }

    function handleMakeOnlineClick() {
        setIsOnlineOpen(true);
    }

    async function handleMakeOnlineConfirm() {
        if (isMakingOnline) return;
        setIsMakingOnline(true);
        const originalData = await mutate("/api/profile/dashboard");

        mutate("/api/profile/dashboard", (current?: DashboardData) => {
            if (!current) return current;
            const updatedInvitations = current.invitations.map((item) => {
                if (item.id === invitation.id) {
                    return {
                        ...item,
                        status: "published" as const,
                        lifecycleStatus: "published" as const,
                        eventStatus: "published" as const,
                    };
                }
                return item;
            });
            return {
                ...current,
                invitations: updatedInvitations,
                published: current.published + 1,
                drafts: current.drafts - 1,
            };
        }, { revalidate: false });

        try {
            const response = await fetch(`/api/invitations/${invitation.id}/publish`, {
                method: "POST",
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
                showToast(result.error || "Unable to make invitation online.", "error");
                mutate("/api/profile/dashboard", originalData, { revalidate: false });
                return;
            }
            showToast("Invitation is online again.", "success");
            mutate("/api/profile/dashboard");
        } catch {
            showToast("Unable to make invitation online.", "error");
            mutate("/api/profile/dashboard", originalData, { revalidate: false });
        } finally {
            setIsMakingOnline(false);
            setIsOnlineOpen(false);
        }
    }

    function handleCopyPublicLink() {
        navigator.clipboard.writeText(publicUrl).then(() => {
            setIsCopied(true);
            showToast("Invitation link copied.", "success");
            window.setTimeout(() => setIsCopied(false), 1600);
        }).catch(() => {
            showToast("Could not copy link", "error");
        });
    }

    return (
        <article className={`profileInviteRow profileInviteRow--bg ${getInvitationArtClass(invitation)}`}>
            <div className="profileInviteInfo">
                <div className="profileInviteDetails">
                    <div className="profileInviteHeader">
                        <p className="inviteType">{invitation.title}</p>
                        <span className={`profileStatus ${lifecycleStatus}`}>
                            {getLifecycleStatusIcon(lifecycleStatus)}
                            {getLifecycleStatusLabel(lifecycleStatus)}
                        </span>
                        {isSample && <span className="sampleLabel">Sample Template</span>}
                    </div>

                    <h3>{getDisplayNames(invitation)}</h3>
                    <p className="inviteMessage">
                        {getDashboardInviteSummary(lifecycleStatus)}
                    </p>

                    <div className="profileInviteMeta">
                        <span>
                            <CalendarDays size={14} aria-hidden="true" />
                            {formatDate(invitation.eventDate)}
                        </span>
                        {invitation.eventTime ? (
                            <span>
                                <Clock size={14} aria-hidden="true" />
                                {formatEventTimeRange(invitation.eventTime)}
                            </span>
                        ) : null}
                        <span>
                            <RefreshCw size={14} aria-hidden="true" />
                            Updated {formatDate(invitation.updatedAt)}
                        </span>
                    </div>

                </div>
            </div>

            {isPublic && !isSample ? (
                <div className="profilePublicLinkWrap">
                    <a className="profilePublicLink" href={previewHref} target="_blank" rel="noreferrer">
                        <ExternalLink size={13} aria-hidden="true" />
                        <span>{publicUrl}</span>
                    </a>
                    <button
                        className="profileCopyLinkBtn"
                        type="button"
                        onClick={handleCopyPublicLink}
                        aria-label="Copy invitation link"
                    >
                        {isCopied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                    </button>
                </div>
            ) : isDraft || isOffline ? (
                <div className="profilePublicLinkWrap profilePublicLinkWrap--empty">
                    <span className="profilePublicLinkPlaceholder">
                        <Lock size={14} aria-hidden="true" />
                        {isOffline ? "Offline. Public link disabled." : "Not published yet. Preview or edit to continue."}
                    </span>
                </div>
            ) : null}

            <div className={`profileInviteActions ${isCompleted ? "profileInviteActions--two" : isOffline || hasAnalyticsAccess ? "profileInviteActions--four" : ""}`}>
                {isDraft ? (
                    <>
                        <Link href={previewHref} className="profileActionBtn profileActionBtn--primary">
                            <Eye size={14} aria-hidden="true" />
                            <span>Preview</span>
                        </Link>
                        <button
                            type="button"
                            className="profileActionBtn"
                            onClick={handleEdit}
                            disabled={isEditing}
                        >
                            {isEditing ? (
                                <>
                                    <Loader2 size={14} className="spinner" aria-hidden="true" />
                                    <span>Editing...</span>
                                </>
                            ) : (
                                <>
                                    <PencilLine size={14} aria-hidden="true" />
                                    <span>Edit</span>
                                </>
                            )}
                        </button>
                        {isSample ? null : (
                            <button
                                type="button"
                                className="profileActionBtn profileActionBtn--danger"
                                onClick={() => setIsDeleteOpen(true)}
                                aria-label={`Delete draft ${invitation.title}`}
                            >
                                <Trash2 size={14} aria-hidden="true" />
                                <span>Delete</span>
                            </button>
                        )}
                    </>
                ) : isOffline ? (
                    <>
                        <Link href={previewHref} className="profileActionBtn profileActionBtn--primary">
                            <Eye size={14} aria-hidden="true" />
                            <span>Preview</span>
                        </Link>
                        <button
                            type="button"
                            className="profileActionBtn"
                            onClick={handleEdit}
                            disabled={isEditing}
                        >
                            {isEditing ? (
                                <>
                                    <Loader2 size={14} className="spinner" aria-hidden="true" />
                                    <span>Editing...</span>
                                </>
                            ) : (
                                <>
                                    <PencilLine size={14} aria-hidden="true" />
                                    <span>Edit</span>
                                </>
                            )}
                        </button>
                        {hasAnalyticsAccess ? (
                            <Link href={analyticsHref} className="profileActionBtn">
                                <BarChart3 size={14} aria-hidden="true" />
                                <span>Analytics</span>
                            </Link>
                        ) : null}
                        <button
                            type="button"
                            className="profileActionBtn profileActionBtn--online"
                            onClick={handleMakeOnlineClick}
                            disabled={isMakingOnline}
                        >
                            {isMakingOnline ? (
                                <Loader2 size={14} className="spinner" aria-hidden="true" />
                            ) : (
                                <Wifi size={14} aria-hidden="true" />
                            )}
                            <span>Go Live</span>
                        </button>
                        {/* Keep for future use:
                        {!isSample && (
                            <button
                                type="button"
                                className="profileActionBtn profileActionBtn--danger"
                                onClick={() => setIsDeleteOpen(true)}
                                aria-label={`Delete invitation ${invitation.title}`}
                            >
                                <Trash2 size={14} aria-hidden="true" />
                                <span>Delete</span>
                            </button>
                        )}
                        */}
                    </>
                ) : isUpcoming || isLiveToday ? (
                    <>
                        <a href={previewHref} target="_blank" rel="noreferrer" className="profileActionBtn profileActionBtn--primary">
                            <ExternalLink size={14} aria-hidden="true" />
                            <span>Open</span>
                        </a>
                        <button
                            type="button"
                            className="profileActionBtn"
                            onClick={handleEdit}
                            disabled={isEditing}
                        >
                            {isEditing ? (
                                <>
                                    <Loader2 size={14} className="spinner" aria-hidden="true" />
                                    <span>Editing...</span>
                                </>
                            ) : (
                                <>
                                    <PencilLine size={14} aria-hidden="true" />
                                    <span>Edit</span>
                                </>
                            )}
                        </button>
                        {hasAnalyticsAccess ? (
                            <Link href={analyticsHref} className="profileActionBtn">
                                <BarChart3 size={14} aria-hidden="true" />
                                <span>Analytics</span>
                            </Link>
                        ) : null}
                        <button
                            type="button"
                            className="profileActionBtn profileActionBtn--offline"
                            onClick={handleTakeOfflineClick}
                            disabled={isTakingOffline}
                        >
                            {isTakingOffline ? (
                                <Loader2 size={14} className="spinner" aria-hidden="true" />
                            ) : (
                                <Power size={14} aria-hidden="true" />
                            )}
                            <span>Take Offline</span>
                        </button>
                    </>
	                ) : (
	                    <>
	                        <a href={previewHref} target="_blank" rel="noreferrer" className="profileActionBtn profileActionBtn--primary">
	                            <Eye size={14} aria-hidden="true" />
	                            <span>View</span>
	                        </a>
	                        <Link href={analyticsHref} className="profileActionBtn">
	                            <BarChart3 size={14} aria-hidden="true" />
	                            <span>Analytics</span>
	                        </Link>
	                    </>
	                )}
            </div>
            {!isSample ? (
                <>
                    <ConfirmModal
                        isOpen={isDeleteOpen}
                        onClose={() => setIsDeleteOpen(false)}
                        onConfirm={handleDeleteConfirm}
                        isPending={isDeleting}
                        title={isDraft ? "Delete Draft" : "Delete Invitation"}
                        message={
                            isDraft ? (
                                <p style={{ margin: 0, lineHeight: "1.5" }}>
                                    Are you sure you want to delete the draft <strong>{invitation.title}</strong>? This action is permanent and cannot be undone.
                                </p>
                            ) : (
                                <p style={{ margin: 0, lineHeight: "1.5" }}>
                                    Are you sure you want to delete <strong>{invitation.title}</strong>? This will permanently delete your website, guest RSVPs, and wishes. This action cannot be undone.
                                </p>
                            )
                        }
                        confirmText={isDraft ? "Delete Draft" : "Delete Invitation"}
                        confirmClassName="modalBtnConfirm--red-pastel"
                        icon={
                            <span className="modalWarningIcon" style={{ color: "#be123c", background: "rgba(255, 241, 242, 0.9)" }}>
                                <AlertTriangle size={24} />
                            </span>
                        }
                    />

                    <ConfirmModal
                        isOpen={isOfflineOpen}
                        onClose={() => setIsOfflineOpen(false)}
                        onConfirm={handleTakeOfflineConfirm}
                        isPending={isTakingOffline}
                        title="Take Invitation Offline"
                        message={
                            <p style={{ margin: 0, lineHeight: "1.5" }}>
                                Are you sure you want to take <strong>{invitation.title}</strong> offline? This disables the public page and guest RSVPs. You can republish it online at any time.
                            </p>
                        }
                        confirmText="Take Offline"
                        confirmClassName="modalBtnConfirm--orange-pastel"
                        icon={
                            <span className="modalWarningIcon" style={{ color: "#b45309", background: "rgba(255, 251, 235, 0.9)" }}>
                                <WifiOff size={24} />
                            </span>
                        }
                    />

                    <ConfirmModal
                        isOpen={isOnlineOpen}
                        onClose={() => setIsOnlineOpen(false)}
                        onConfirm={handleMakeOnlineConfirm}
                        isPending={isMakingOnline}
                        title="Publish Invitation"
                        message={
                            <p style={{ margin: 0, lineHeight: "1.5" }}>
                                Are you sure you want to make <strong>{invitation.title}</strong> live? This activates the public page and allows guests to view details and RSVP.
                            </p>
                        }
                        confirmText="Go Live"
                        confirmClassName="modalBtnConfirm--green-pastel"
                        icon={
                            <span className="modalWarningIcon" style={{ color: "#047857", background: "rgba(236, 253, 245, 0.9)" }}>
                                <Wifi size={24} />
                            </span>
                        }
                    />
                </>
            ) : null}
        </article>
    );
}

type DashboardLifecycleStatus = "draft" | "upcoming" | "live_today" | "completed" | "offline";

function getInvitationLifecycleStatus(invitation: InvitationData): DashboardLifecycleStatus {
    if (isInvitationCompleted(invitation)) {
        return "completed";
    }

    if (invitation.lifecycleStatus === "unpublished" || invitation.eventStatus === "unpublished") {
        return "offline";
    }

    if (invitation.status !== "published") {
        return "draft";
    }

    const phase = getEventPhase(invitation);
    if (phase === "upcoming") return "upcoming";
    if (phase === "in_progress") return "live_today";
    return "completed";
}

function getLifecycleStatusLabel(status: DashboardLifecycleStatus) {
    switch (status) {
        case "draft":
            return "Draft";
        case "upcoming":
            return "Upcoming";
        case "live_today":
            return "Live Today";
        case "completed":
            return "Completed";
        case "offline":
            return "Offline";
    }
}

function getLifecycleStatusIcon(status: DashboardLifecycleStatus) {
    const size = 12;
    switch (status) {
        case "draft":
            return <FileText size={size} aria-hidden="true" />;
        case "upcoming":
            return <CalendarCheck size={size} aria-hidden="true" />;
        case "live_today":
            return <Sparkles size={size} aria-hidden="true" />;
        case "completed":
            return <CheckCircle2 size={size} aria-hidden="true" />;
        case "offline":
            return <WifiOff size={size} aria-hidden="true" />;
    }
}

function getDashboardInviteSummary(status: DashboardLifecycleStatus) {
    switch (status) {
        case "draft":
            return "Complete details, then publish when ready.";
        case "upcoming":
            return "Public invite is live and ready for guests.";
        case "live_today":
            return "Event is live today. Track guest activity.";
        case "completed":
            return "Event completed. Review views and activity.";
        case "offline":
            return "Offline. Guests cannot access this invitation.";
    }
}

function getDisplayNames(invitation: InvitationData) {
    return invitation.secondaryName
        ? `${invitation.primaryName} & ${invitation.secondaryName}`
        : invitation.primaryName;
}

function getInvitationArtClass(invitation: InvitationData) {
    const category = invitation.category.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    if (category.includes("birthday")) return "profileInviteRow--birthday";
    if (category.includes("house")) return "profileInviteRow--housewarming";
    if (category.includes("engagement")) return "profileInviteRow--engagement";
    if (category.includes("graduation")) return "profileInviteRow--graduation";
    if (category.includes("wedding")) return "profileInviteRow--wedding";
    return "profileInviteRow--default";
}

function formatDate(value: string) {
    try {
        return new Intl.DateTimeFormat("en", {
            month: "short",
            day: "numeric",
            year: "numeric",
        }).format(new Date(value));
    } catch {
        return value;
    }
}

function formatEventTimeRange(value: string) {
    return value.replace(/\s*-\s*/g, " - ").trim();
}
