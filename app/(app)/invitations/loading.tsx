import { ButtonSkeleton, Skeleton, TextSkeleton } from "@/components/ui/Skeleton";

export default function InvitationsLoading() {
    return (
        <main className="profilePage invitationsPage" aria-busy="true">
            <section className="profileInvitations profileInvitationsFull">
                <header className="profileControls">
                    <div>
                        <TextSkeleton width={240} height={30} />
                        <TextSkeleton width={300} height={15} />
                    </div>
                    <Skeleton className="profileSearchSkeleton" rounded="lg" />
                </header>

                <div className="profileInvitationsContainer">
                    <nav className="profileFilterTabs" aria-hidden="true">
                        <ButtonSkeleton width={70} height={36} />
                        <ButtonSkeleton width={112} height={36} />
                        <ButtonSkeleton width={120} height={36} />
                        <ButtonSkeleton width={92} height={36} />
                    </nav>

                    <div className="profileInvitationList" aria-hidden="true">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <article className="profileInviteRow profileInviteRow--bg profileInviteRow--wedding" key={index}>
                                <div className="profileInviteInfo">
                                    <div className="profileInviteDetails">
                                        <div className="profileInviteHeader">
                                            <TextSkeleton width={150} height={14} />
                                            <ButtonSkeleton width={92} height={26} />
                                        </div>
                                        <TextSkeleton width={220} height={24} />
                                        <TextSkeleton width="82%" height={15} />
                                        <div className="profileInviteMeta">
                                            <TextSkeleton width={112} height={15} />
                                            <TextSkeleton width={150} height={15} />
                                            <TextSkeleton width={140} height={15} />
                                        </div>
                                    </div>
                                </div>
                                <Skeleton className="profilePublicLinkWrap" style={{ width: "100%", height: 40 }} rounded="lg" />
                                <div className="profileInviteActions">
                                    <ButtonSkeleton width="100%" height={34} />
                                    <ButtonSkeleton width="100%" height={34} />
                                    <ButtonSkeleton width="100%" height={34} />
                                </div>
                            </article>
                        ))}
                    </div>
                </div>
            </section>
        </main>
    );
}
