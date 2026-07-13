import { Skeleton, TextSkeleton } from "@/components/ui/Skeleton";

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

            <section className="profileTransactions" aria-label="Loading transactions">
                <div className="paymentsHeader">
                    <div className="paymentsHeaderBody">
                        <Skeleton className="paymentsHeaderIcon" rounded="lg" />
                        <div className="paymentsHeaderText">
                            <TextSkeleton width={116} height={18} />
                            <TextSkeleton width={260} height={12} />
                        </div>
                    </div>
                </div>

                <div className="paymentsSection">
                    <div className="paymentsList">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <article className="profileTransactionCard profileTransactionCard--skeleton" key={index}>
                                <Skeleton className="profileTransactionIcon" rounded="lg" />
                                <div className="profileTransactionBody">
                                    <div className="profileTransactionTitle">
                                        <TextSkeleton width={132} height={16} />
                                        <Skeleton style={{ width: 62, height: 20 }} rounded="full" />
                                    </div>
                                    <TextSkeleton width={180} height={12} />
                                    <div className="profileTransactionMeta">
                                        <TextSkeleton width={160} height={12} />
                                        <TextSkeleton width={140} height={18} />
                                    </div>
                                </div>
                                <div className="profileTransactionAside">
                                    <TextSkeleton width={52} height={20} />
                                    <TextSkeleton width={26} height={10} />
                                </div>
                                <div className="profileTransactionAction">
                                    <Skeleton style={{ width: 134, height: 30 }} rounded="lg" />
                                </div>
                            </article>
                        ))}
                    </div>
                </div>
            </section>
        </main>
    );
}
