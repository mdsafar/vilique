"use client";

import { useState } from "react";
import { LogOut, AlertTriangle } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import ConfirmModal from "./ConfirmModal";
import { useToast } from "./Toast";

type Props = {
    profile: {
        name: string | null;
        email: string | null;
        avatarUrl: string | null;
    } | null;
    activePublishedCount: number;
    initials: string;
    greeting: string;
};

export default function ProfileCard({ profile, activePublishedCount, initials, greeting }: Props) {
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [isPending, setIsPending] = useState(false);
    const { showToast } = useToast();

    const displayName = profile?.name || "Guest";
    const email = profile?.email || "Sign in to save your invitations";

    const handleLogoutConfirm = async () => {
        setIsPending(true);
        try {
            showToast("Signing out...", "info");
            await signOut();
        } catch (error) {
            // Note: redirect() throws a Next.js NEXT_REDIRECT error, which is caught here.
            // We ignore NEXT_REDIRECT since it means the action succeeded and is navigating the user.
            if (error instanceof Error && !error.message.includes("NEXT_REDIRECT")) {
                showToast("Failed to sign out. Please try again.", "error");
            }
        } finally {
            setIsPending(false);
            setIsConfirmOpen(false);
        }
    };

    return (
        <article className="profileCard">
            <div className="profileCardMain">
                <div
                    className="profileAvatar"
                    style={profile?.avatarUrl ? { backgroundImage: `url(${profile.avatarUrl})` } : undefined}
                    aria-hidden="true"
                >
                    {profile?.avatarUrl ? null : initials}
                </div>

                <div className="profileDetails">
                    <span className="profileGreeting">{greeting},</span>
                    <h1>{displayName}</h1>
                    <p>{email}</p>
                </div>
            </div>

            {profile && (
                <button
                    className="profileLogoutButton"
                    onClick={() => setIsConfirmOpen(true)}
                    title="Log out"
                    type="button"
                >
                    <LogOut size={14} />
                    <span>Log out</span>
                </button>
            )}

            {/* Pay-per-publish pricing widget inside the overview */}
            <div className="profilePlanUsage">
                <div className="usageMeta">
                    <span>Publishing Summary</span>
                </div>
                <div className="pricingRateInfo">
                    <div className="rateDetails">
                        <span className="rateLabel">Published Live:</span>
                        <strong className="rateValue">{activePublishedCount}</strong>
                    </div>
                    <div className="rateDetails">
                        <span className="rateLabel">Total Spent:</span>
                        <strong className="rateValue">₹{activePublishedCount * 20}</strong>
                    </div>
                </div>
                <p className="usageDisclaimer">One-time publishing total for invitations hosted live indefinitely.</p>
            </div>

            <ConfirmModal
                isOpen={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
                onConfirm={handleLogoutConfirm}
                isPending={isPending}
                title="Sign Out"
                message="Are you sure you want to sign out of your account? You will need to sign in again to access your drafts and published invitations."
                confirmText="Sign out"
                icon={
                    <span className="modalWarningIcon">
                        <AlertTriangle size={24} />
                    </span>
                }
            />
        </article>
    );
}
