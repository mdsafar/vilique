import { Skeleton, TextSkeleton } from "@/components/ui/Skeleton";

export default function PublicInviteSkeleton() {
    return (
        <main className="publicInvitationWrapper" aria-busy="true">
            <div className="invitePreviewShell">
                <section className="weddingCard active publicInviteSkeletonCard" aria-hidden="true">
                    <TextSkeleton width={180} height={12} />
                    <TextSkeleton width={260} height={46} />
                    <TextSkeleton width={180} height={14} />
                    <Skeleton style={{ width: "100%", height: 82 }} rounded="lg" />
                    <Skeleton style={{ width: "76%", height: 32 }} rounded="full" />
                    <Skeleton style={{ width: "100%", height: 92 }} rounded="lg" />
                    <Skeleton style={{ width: "100%", height: 108 }} rounded="lg" />
                </section>
            </div>
        </main>
    );
}
