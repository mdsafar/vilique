"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    CalendarDays,
    Clock,
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
    Lock,
} from "lucide-react";
import { deleteInvitation } from "@/app/(app)/profile/actions";
import { InvitationData } from "@/types/invitation";
import { getPublicInvitationUrl } from "@/lib/config/site";
import { parseInvitationDateParts } from "@/lib/invitationDate";
import ConfirmModal from "./ConfirmModal";
import { useToast } from "./Toast";

interface ProfileInvitationsListProps {
    initialInvitations: InvitationData[];
    invitationStats: Record<string, { rsvps: number; views: number; acceptsRsvps?: boolean }>;
}

export default function ProfileInvitationsList({
    initialInvitations,
    invitationStats,
}: ProfileInvitationsListProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | "upcoming" | "completed" | "draft">("all");

    // Dynamic filtering
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

        const matchesSearch = combinedText.includes(searchTerm.toLowerCase());

        return matchesStatus && matchesSearch;
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

    const handleClearSearch = () => {
        setSearchTerm("");
    };

    const handleResetAll = () => {
        setSearchTerm("");
        setStatusFilter("all");
    };

    return (
        <div className="profileInvitationsContainer">
            {/* Search & Filter Bar */}
            <div className="profileControls">
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

                <div className="profileFilterTabs">
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
                </div>
            </div>

            {/* Invitations Render Area */}
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
    const [isCopied, setIsCopied] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isTakingOffline, setIsTakingOffline] = useState(false);
    const router = useRouter();
    const { showToast } = useToast();

    const lifecycleStatus = getInvitationLifecycleStatus(invitation);
    const isDraft = lifecycleStatus === "draft";
    const isUpcoming = lifecycleStatus === "upcoming";
    const isLiveToday = lifecycleStatus === "live_today";
    const isCompleted = lifecycleStatus === "completed";
    const isOffline = lifecycleStatus === "offline";
    const isPublic = isUpcoming || isLiveToday || isCompleted;

    const isSample = invitation.id.startsWith("sample-");
    const editHref = isSample ? "/templates" : `/builder?id=${invitation.id}&from=invitations`;
    const previewHref = isSample
        ? "/templates"
        : isPublic
            ? `/i/${invitation.slug}`
            : `/builder/preview?id=${invitation.id}`;
    const publicUrl = getPublicInvitationUrl(invitation.slug);

    const handleEdit = () => {
        setIsEditing(true);
        router.push(editHref);
    };

    async function handleDeleteConfirm() {
        setIsDeleting(true);
        try {
            const formData = new FormData();
            formData.append("id", invitation.id);
            const result = await deleteInvitation(formData);
            if (!result?.ok) {
                showToast(result?.error || "Failed to delete invitation", "error");
                return;
            }
            showToast(isDraft ? "Draft deleted." : "Invitation deleted.", "success");
        } catch (error) {
            showToast(error instanceof Error ? error.message : "Failed to delete invitation", "error");
        } finally {
            setIsDeleting(false);
            setIsDeleteOpen(false);
        }
    }

    async function handleTakeOffline() {
        if (isTakingOffline) return;
        setIsTakingOffline(true);
        try {
            const response = await fetch(`/api/invitations/${invitation.id}/unpublish`, {
                method: "POST",
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
                showToast(result.error || "Unable to take invitation offline.", "error");
                return;
            }
            showToast("Invitation taken offline.", "success");
            router.refresh();
        } catch {
            showToast("Unable to take invitation offline.", "error");
        } finally {
            setIsTakingOffline(false);
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
                        <span className={`profileStatus ${lifecycleStatus}`}>
                            {getLifecycleStatusIcon(lifecycleStatus)}
                            {getLifecycleStatusLabel(lifecycleStatus)}
                        </span>
                        {isSample && <span className="sampleLabel">Sample Template</span>}
                    </div>

                    <p className="inviteType">{invitation.title}</p>
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
                        <span>Updated {formatDate(invitation.updatedAt)}</span>
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

            <div className="profileInviteActions">
                {isDraft || isOffline ? (
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
                        <button
                            type="button"
                            className="profileActionBtn profileActionBtn--offline"
                            onClick={handleTakeOffline}
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
                        <Link href={""} className="profileActionBtn">
                            <BarChart3 size={14} aria-hidden="true" />
                            <span>Analytics</span>
                        </Link>
                        <button
                            type="button"
                            className="profileActionBtn profileActionBtn--danger"
                            onClick={() => setIsDeleteOpen(true)}
                            aria-label={`Delete invitation ${invitation.title}`}
                        >
                            <Trash2 size={14} aria-hidden="true" />
                            <span>Delete</span>
                        </button>
                    </>
                )}
            </div>
            {!isSample ? (
                <ConfirmModal
                    isOpen={isDeleteOpen}
                    onClose={() => setIsDeleteOpen(false)}
                    onConfirm={handleDeleteConfirm}
                    isPending={isDeleting}
                    title={isDraft ? "Delete Draft" : "Delete Invitation"}
                    message={
                        <>
                            Are you sure you want to delete <strong>{invitation.title}</strong>? This action is permanent and cannot be undone.
                        </>
                    }
                    confirmText={isDraft ? "Delete Draft" : "Delete Invitation"}
                    confirmStyle={{
                        background: "#dc2626",
                        color: "#fff",
                        boxShadow: "0 4px 12px rgba(220, 38, 38, 0.2)",
                    }}
                    icon={
                        <span className="modalWarningIcon" style={{ color: "#ef4444", background: "rgba(239, 68, 68, 0.1)" }}>
                            <AlertTriangle size={24} />
                        </span>
                    }
                />
            ) : null}
        </article>
    );
}

type DashboardLifecycleStatus = "draft" | "upcoming" | "live_today" | "completed" | "offline";

function getInvitationLifecycleStatus(invitation: InvitationData): DashboardLifecycleStatus {
    if (invitation.lifecycleStatus === "unpublished" || invitation.eventStatus === "unpublished") {
        return "offline";
    }

    if (invitation.status !== "published") {
        return "draft";
    }

    const eventDate = parseInvitationDateParts(invitation.eventDate);
    if (!eventDate) return "upcoming";

    const today = getTodayParts(invitation.eventTimezone);
    const eventValue = toDateNumber(eventDate);
    const todayValue = toDateNumber(today);

    if (eventValue > todayValue) return "upcoming";
    if (eventValue === todayValue) return "live_today";
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
            return "Complete details, preview, then publish when ready.";
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

function getTodayParts(timezone?: string | null) {
    const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone || "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });
    const parts = Object.fromEntries(formatter.formatToParts(new Date()).map((part) => [part.type, part.value]));
    return {
        year: Number(parts.year),
        month: Number(parts.month),
        day: Number(parts.day),
    };
}

function toDateNumber(parts: { year: number; month: number; day: number }) {
    return parts.year * 10000 + parts.month * 100 + parts.day;
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
