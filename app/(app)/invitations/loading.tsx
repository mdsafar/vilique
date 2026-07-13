import { ButtonSkeleton, Skeleton, TextSkeleton } from "@/components/ui/Skeleton";

export default function InvitationsLoading() {
    return (
        <main className="profilePage invitationsPage" aria-busy="true">
            <section className="profileInvitations profileInvitationsFull">
                <header>
                    <div>
                        <TextSkeleton width={170} height={28} />
                        <TextSkeleton width={260} height={14} />
                    </div>
                </header>
                <div className="profileControls">
                    <Skeleton style={{ width: "min(100%, 460px)", height: 44 }} rounded="lg" />
                    <Skeleton style={{ width: "min(100%, 330px)", height: 44 }} rounded="lg" />
                </div>
                <div className="profileInvitationList" aria-hidden="true">
                    {Array.from({ length: 4 }).map((_, index) => (
                        <article className="profileInviteRow" key={index}>
                            <Skeleton className="profileInvitePreview" style={{ minHeight: 160 }} rounded="xl" />
                            <div className="profileInviteInfo">
                                <ButtonSkeleton width={110} height={26} />
                                <TextSkeleton width={210} height={24} />
                                <TextSkeleton width={260} height={14} />
                                <TextSkeleton width={300} height={15} />
                                <Skeleton style={{ width: "100%", height: 40 }} rounded="lg" />
                                <div className="profileInviteActions">
                                    <ButtonSkeleton width="100%" height={34} />
                                    <ButtonSkeleton width="100%" height={34} />
                                    <ButtonSkeleton width="100%" height={34} />
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            </section>
        </main>
    );
}
