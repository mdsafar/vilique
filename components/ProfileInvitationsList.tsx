"use client";

import { useState } from "react";
import Link from "next/link";
import type { CSSProperties } from "react";
import {
    CalendarDays,
    Eye,
    PencilLine,
    Trash2,
    UsersRound,
    Search,
    X,
    Filter,
} from "lucide-react";
import { deleteInvitation } from "@/app/profile/actions";
import { InvitationData } from "@/types/invitation";

interface ProfileInvitationsListProps {
    initialInvitations: InvitationData[];
    rsvps: number;
}

export default function ProfileInvitationsList({
    initialInvitations,
    rsvps,
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
                            rsvps={rsvps}
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

function InvitationRow({ invitation, rsvps }: { invitation: InvitationData; rsvps: number }) {
    const isPublished = invitation.status === "published";
    const isSample = invitation.id.startsWith("sample-");
    const editHref = invitation.id.startsWith("sample-") ? "/templates" : `/builder?id=${invitation.id}`;
    const previewHref = invitation.id.startsWith("sample-") ? "/templates" : `/invite/${invitation.slug}`;

    return (
        <article className="profileInviteRow">
            <div
                className={`profileInvitePreview ${invitation.category}`}
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
                    <span className={`profileStatus ${isPublished ? "published" : "draft"}`}>
                        <span className="pulseDot" />
                        {isPublished ? "Published" : "Draft"}
                    </span>
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
                    <span>
                        <UsersRound size={14} aria-hidden="true" />
                        {rsvps} RSVPs
                    </span>
                    <span>Updated {formatDate(invitation.updatedAt)}</span>
                </div>

                <div className="profileInviteActions">
                    <Link href={previewHref} className="btnPreview">
                        <Eye size={14} aria-hidden="true" />
                        Preview
                    </Link>
                    <Link href={editHref} className="btnEdit">
                        <PencilLine size={14} aria-hidden="true" />
                        Edit
                    </Link>
                    {isSample ? null : (
                        <form action={deleteInvitation}>
                            <input type="hidden" name="id" value={invitation.id} />
                            <button
                                type="submit"
                                className="btnDelete"
                                aria-label={`Delete ${invitation.title}`}
                            >
                                <Trash2 size={14} aria-hidden="true" />
                                Delete
                            </button>
                        </form>
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
