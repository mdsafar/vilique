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
        </main>
    );
}
