import { ButtonSkeleton, Skeleton, TextSkeleton } from "@/components/ui/Skeleton";

export default function ProfilePageSkeleton() {
    return (
        <main className="profilePage" aria-busy="true">
            <section className="profileOverview" aria-label="Loading profile overview">
                <article className="profileCard">
                    <div className="profileIdentity">
                        <Skeleton style={{ width: 64, height: 64 }} rounded="full" />
                        <div className="profileDetails">
                            <TextSkeleton width={112} height={12} />
                            <TextSkeleton width={160} height={24} />
                            <TextSkeleton width={220} height={13} />
                        </div>
                    </div>
                    <Skeleton style={{ width: "100%", height: 126 }} rounded="xl" />
                </article>

                <section className="profileStats" aria-label="Loading invitation metrics">
                    {Array.from({ length: 4 }).map((_, index) => (
                        <article className="profileStat" key={index}>
                            <Skeleton style={{ width: 34, height: 34 }} rounded="md" />
                            <div>
                                <TextSkeleton width={28} height={24} />
                                <TextSkeleton width={84} height={13} />
                                <TextSkeleton width={118} height={11} />
                            </div>
                        </article>
                    ))}
                </section>
            </section>

            <section className="profileInvitations">
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
                    {Array.from({ length: 2 }).map((_, index) => (
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
