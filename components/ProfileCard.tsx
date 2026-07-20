"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { HelpCircle, LogOut, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/client";
import ConfirmModal from "./ConfirmModal";
import { useToast } from "./Toast";

type Props = {
    profile: {
        name: string | null;
        email: string | null;
        avatarUrl: string | null;
    } | null;
    activePublishedCount: number;
    totalSpent: number;
    initials: string;
    greeting: string;
};

export default function ProfileCard({ profile, activePublishedCount, totalSpent, initials, greeting }: Props) {
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [isPending, setIsPending] = useState(false);
    const { showToast } = useToast();
    const router = useRouter();

    const displayName = profile?.name || "Guest";
    const email = profile?.email || "Sign in to save your invitations";

    const handleLogoutConfirm = async () => {
        setIsPending(true);
        showToast("Signing out...", "info");

        // 1. Complete server sign-out while inline loader is visible in modal
        try {
            await signOut();
        } catch {
            // Ignore server action redirect error
        }

        // 2. Close modal and reset pending state
        setIsConfirmOpen(false);
        setIsPending(false);

        // 3. Immediately replace route to '/' via App Router
        router.replace("/");

        // 4. Clear client session after starting navigation to public route
        try {
            const supabase = createClient();
            await supabase.auth.signOut();
        } catch {
            // Ignore client signout error
        }
    };

    return (
        <article className="profileCard">
            <div className="profileCardMain">
                <div className="profileAvatar" aria-hidden="true">
                    <span>{initials}</span>
                    {profile?.avatarUrl ? (
                        <Image
                            src={profile.avatarUrl}
                            alt=""
                            fill
                            sizes="66px"
                            unoptimized
                            referrerPolicy="no-referrer"
                        />
                    ) : null}
                </div>

                <div className="profileDetails">
                    <span className="profileGreeting">{greeting},</span>
                    <h1>{displayName}</h1>
                    <p>{email}</p>
                </div>
            </div>

            {profile && (
                <div className="profileHeaderButtons">
                    <Link href="/contact" className="profileHistoryButton" title="Support and legal">
                        <HelpCircle size={14} />
                        <span>Support</span>
                    </Link>
                    <button
                        className="profileLogoutButton"
                        onClick={() => setIsConfirmOpen(true)}
                        title="Sign out"
                        type="button"
                    >
                        <LogOut size={14} />
                        <span>Sign out</span>
                    </button>
                </div>
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
                        <strong className="rateValue">₹{totalSpent}</strong>
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
                confirmClassName="modalBtnConfirm--red-pastel"
                icon={
                    <span className="modalWarningIcon" style={{ color: "#be123c", background: "rgba(255, 241, 242, 0.9)" }}>
                        <AlertTriangle size={24} />
                    </span>
                }
            />
        </article>
    );
}
