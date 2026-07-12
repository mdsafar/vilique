"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import {
    CalendarDays,
    Eye,
    BarChart3,
    PencilLine,
    Trash2,
    UsersRound,
    Search,
    X,
    Filter,
    ExternalLink,
    Copy,
    Check,
    Archive,
    Loader2,
} from "lucide-react";
import { deleteInvitation } from "@/app/(app)/profile/actions";
import { InvitationData } from "@/types/invitation";
import { getPublicInvitationUrl } from "@/lib/config/site";
import { getEventPhase } from "@/lib/lifecycle";
import ConfirmModal from "./ConfirmModal";
import { AlertTriangle } from "lucide-react";
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
    const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");

    // Dynamic filtering
    const filteredInvitations = initialInvitations.filter((item) => {
        const matchesStatus =
            statusFilter === "all" || item.status === statusFilter;

        const combinedText = `
            ${item.title} 
            ${item.primaryName} 
            ${item.secondaryName || ""} 
            ${item.category}
        `.toLowerCase();

        const matchesSearch = combinedText.includes(searchTerm.toLowerCase());

        return matchesStatus && matchesSearch;
    });

    const publishedCount = initialInvitations.filter(
        (item) => item.status === "published"
    ).length;
    const draftsCount = initialInvitations.filter(
        (item) => item.status === "draft"
    ).length;

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
                        className={`filterTabBtn ${statusFilter === "published" ? "active" : ""}`}
                        onClick={() => setStatusFilter("published")}
                    >
                        Published <span className="pub">{publishedCount}</span>
                    </button>
                    <button
                        type="button"
                        className={`filterTabBtn ${statusFilter === "draft" ? "active" : ""}`}
                        onClick={() => setStatusFilter("draft")}
                    >
                        Drafts <span className="drf">{draftsCount}</span>
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
    stats,
}: {
    invitation: InvitationData;
    stats: { rsvps: number; views: number; acceptsRsvps?: boolean };
}) {
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const [isDuplicating, setIsDuplicating] = useState(false);
    const [isArchiving, setIsArchiving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const router = useRouter();
    const { showToast } = useToast();


    const eventPhase = getEventPhase({
        eventDate: invitation.eventDate,
        eventTime: invitation.eventTime,
        eventTimezone: invitation.eventTimezone,
    });
    const completed = invitation.lifecycleStatus === "completed" || eventPhase === "completed";
    const inProgress = !completed && eventPhase === "in_progress";

    const isPublished = invitation.status === "published";
    const isSample = invitation.id.startsWith("sample-");
    const editHref = isSample ? "/templates" : `/builder?id=${invitation.id}&from=profile`;
    const previewHref = isSample
        ? "/templates"
        : isPublished
            ? `/i/${invitation.slug}`
            : `/builder/preview?id=${invitation.id}`;
    const publicUrl = getPublicInvitationUrl(invitation.slug);

    const handleEdit = () => {
        setIsEditing(true);
        router.push(editHref);
    };

    async function handleDuplicate() {
        setIsDuplicating(true);
        try {
            const res = await fetch(`/api/invitations/${invitation.id}/duplicate`, {
                method: "POST"
            });
            if (!res.ok) throw new Error("Duplication failed");
            const data = await res.json();
            showToast("Invitation duplicated successfully!", "success");
            router.push(`/builder?id=${data.id}`);
        } catch {
            showToast("Failed to duplicate invitation", "error");
        } finally {
            setIsDuplicating(false);
        }
    }

    async function handleArchive() {
        setIsArchiving(true);
        try {
            const res = await fetch(`/api/invitations/${invitation.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ lifecycleStatus: "archived" }),
            });
            if (!res.ok) throw new Error("Archival failed");
            showToast("Invitation archived successfully", "success");
            window.location.reload();
        } catch {
            showToast("Failed to archive invitation", "error");
        } finally {
            setIsArchiving(false);
        }
    }

    async function handleDeleteConfirm() {
        setIsDeleting(true);
        try {
            const formData = new FormData();
            formData.append("id", invitation.id);
            await deleteInvitation(formData);
            showToast("Invitation deleted successfully", "success");
        } catch {
            showToast("Failed to delete invitation", "error");
        } finally {
            setIsDeleting(false);
            setIsDeleteOpen(false);
        }
    }

    function handleCopyPublicLink() {
        navigator.clipboard.writeText(publicUrl).then(() => {
            setIsCopied(true);
            showToast("Invitation link copied", "success");
            window.setTimeout(() => setIsCopied(false), 1600);
        }).catch(() => {
            showToast("Could not copy link", "error");
        });
    }

    return (
        <article className="profileInviteRow">
            <div
                className={`profileInvitePreview ${invitation.category} ${invitation.templateId}`}
                style={{
                    "--invite-accent": invitation.theme.primaryColor,
                    "--invite-soft": invitation.theme.secondaryColor,
                } as CSSProperties}
            >
                <span>{invitation.title}</span>
                <h3>
                    {invitation.secondaryName
                        ? `${invitation.primaryName} & ${invitation.secondaryName}`
                        : invitation.primaryName}
                </h3>
                <p>{invitation.category.replace("_", " ")}</p>
                <div>
                    <b>{formatMonth(invitation.eventDate)}</b>
                    <strong>{formatDay(invitation.eventDate)}</strong>
                    <b>{invitation.eventTime.split("-")[0]?.trim() || "Time"}</b>
                </div>
            </div>

            <div className="profileInviteInfo">
                <div className="profileInviteHeader">
                    {completed ? (
                        <span className="profileStatus completed">
                            Event Completed
                        </span>
                    ) : inProgress ? (
                        <span className="profileStatus published">
                            <span className="pulseDot" />
                            Event Started
                        </span>
                    ) : (
                        <span className={`profileStatus ${isPublished ? "published" : "draft"}`}>
                            <span className="pulseDot" />
                            {isPublished ? "Published" : "Draft"}
                        </span>
                    )}
                    {isSample && <span className="sampleLabel">Sample Template</span>}
                </div>

                <h3>{invitation.title}</h3>
                <p className="inviteMessage">
                    {invitation.message || "Ready to personalize and share with guests."}
                </p>

                <div className="profileInviteMeta">
                    <span>
                        <CalendarDays size={14} aria-hidden="true" />
                        {formatDate(invitation.eventDate)}
                    </span>
                    {stats.acceptsRsvps ? (
                        <span>
                            <UsersRound size={14} aria-hidden="true" />
                            {stats.rsvps} RSVPs
                        </span>
                    ) : null}
                    <span>
                        <BarChart3 size={14} aria-hidden="true" />
                        {stats.views} Views
                    </span>
                    <span>Updated {formatDate(invitation.updatedAt)}</span>
                </div>

                {isPublished && !isSample ? (
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
                ) : null}

                <div className="profileInviteActions">
                    {completed ? (
                        <>
                            <a href={previewHref} target="_blank" rel="noreferrer" className="btnPreview">
                                <Eye size={14} aria-hidden="true" />
                                <span>View</span>
                            </a>
                            <button
                                type="button"
                                className="btnDuplicate"
                                onClick={handleDuplicate}
                                disabled={isDuplicating}
                                style={{
                                    background: "#f1f5f9",
                                    color: "#334155",
                                    border: "1px solid #e2e8f0"
                                }}
                            >
                                {isDuplicating ? <Loader2 size={14} className="spinner" aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                                <span>{isDuplicating ? "Cloning..." : "Duplicate"}</span>
                            </button>
                            <button
                                type="button"
                                className="btnArchive"
                                onClick={handleArchive}
                                disabled={isArchiving}
                                style={{
                                    background: "#f1f5f9",
                                    color: "#334155",
                                    border: "1px solid #e2e8f0"
                                }}
                            >
                                {isArchiving ? <Loader2 size={14} className="spinner" aria-hidden="true" /> : <Archive size={14} aria-hidden="true" />}
                                <span>{isArchiving ? "Archiving..." : "Archive"}</span>
                            </button>
                            <Link href={`/builder?id=${invitation.id}&tab=rsvps`} className="btnAnalytics">
                                <UsersRound size={14} aria-hidden="true" />
                                <span>Analytics</span>
                            </Link>
                        </>
                    ) : (
                        <>
                            <Link href={previewHref} className="btnPreview">
                                <Eye size={14} aria-hidden="true" />
                                <span>{isPublished ? "View invitation" : "Preview"}</span>
                            </Link>
                            <button
                                type="button"
                                className="btnEdit"
                                onClick={handleEdit}
                                disabled={isEditing}
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: "6px",
                                    cursor: isEditing ? "not-allowed" : "pointer"
                                }}
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
                        </>
                    )}
                    {isSample ? null : (
                        <>
                            <button
                                type="button"
                                className="btnDelete"
                                onClick={() => setIsDeleteOpen(true)}
                                aria-label={`Delete ${invitation.title}`}
                            >
                                <Trash2 size={14} aria-hidden="true" />
                                <span>Delete</span>
                            </button>

                            <ConfirmModal
                                isOpen={isDeleteOpen}
                                onClose={() => setIsDeleteOpen(false)}
                                onConfirm={handleDeleteConfirm}
                                isPending={isDeleting}
                                title="Delete Invitation"
                                message={
                                    <>
                                        Are you sure you want to delete <strong>{invitation.title}</strong>? This action is permanent and cannot be undone.
                                    </>
                                }
                                confirmText="Delete"
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
                        </>
                    )}
                </div>
            </div>
        </article>
    );
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

function formatMonth(value: string) {
    try {
        return new Intl.DateTimeFormat("en", { month: "short" }).format(new Date(value)).toUpperCase();
    } catch {
        return "MMM";
    }
}

function formatDay(value: string) {
    try {
        return new Intl.DateTimeFormat("en", { day: "2-digit" }).format(new Date(value));
    } catch {
        return "00";
    }
}
