import { ClipboardCheck, Eye, PencilLine, UsersRound } from "lucide-react";

export default function ProfileLoading() {
    return (
        <main className="profilePage">
            <section className="profileOverview">
                <article className="profileCard skeletonPulse" style={{ minHeight: "160px", position: "relative" }}>
                    <div className="profileCardMain">
                        <div className="profileAvatar" style={{ background: "rgba(23, 23, 23, 0.05)" }} />
                        <div className="profileDetails" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            <div style={{ width: "80px", height: "12px", background: "rgba(23,23,23,0.06)", borderRadius: "4px" }} />
                            <div style={{ width: "160px", height: "24px", background: "rgba(23,23,23,0.08)", borderRadius: "6px" }} />
                            <div style={{ width: "220px", height: "14px", background: "rgba(23,23,23,0.05)", borderRadius: "4px" }} />
                        </div>
                    </div>

                    <div style={{ position: "absolute", top: "16px", right: "16px", width: "74px", height: "28px", background: "rgba(23, 23, 23, 0.05)", borderRadius: "10px" }} />

                    <div className="profilePlanUsage" style={{ borderTop: "1px dashed rgba(23, 23, 23, 0.06)", paddingTop: "14px", marginTop: "14px" }}>
                        <div className="usageMeta">
                            <div style={{ width: "120px", height: "12px", background: "rgba(23,23,23,0.05)", borderRadius: "4px" }} />
                        </div>
                        <div className="pricingRateInfo" style={{ display: "flex", gap: "24px", marginTop: "10px" }}>
                            <div className="rateDetails">
                                <div style={{ width: "110px", height: "14px", background: "rgba(23,23,23,0.04)", borderRadius: "4px" }} />
                            </div>
                            <div className="rateDetails">
                                <div style={{ width: "100px", height: "14px", background: "rgba(23,23,23,0.04)", borderRadius: "4px" }} />
                            </div>
                        </div>
                    </div>
                </article>

                <section className="profileStats">
                    {[
                        { icon: ClipboardCheck, tone: "green" },
                        { icon: PencilLine, tone: "orange" },
                        { icon: Eye, tone: "blue" },
                        { icon: UsersRound, tone: "rose" },
                    ].map((item, idx) => {
                        const Icon = item.icon;
                        return (
                            <article className={`profileStat ${item.tone} skeletonPulse`} key={idx}>
                                <span>
                                    <Icon size={24} />
                                </span>
                                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                    <div style={{ width: "40px", height: "20px", background: "rgba(0,0,0,0.08)", borderRadius: "4px" }} />
                                    <div style={{ width: "80px", height: "12px", background: "rgba(0,0,0,0.06)", borderRadius: "4px" }} />
                                </div>
                            </article>
                        );
                    })}
                </section>
            </section>

            <section className="profileInvitations">
                <header>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <div style={{ width: "180px", height: "22px", background: "rgba(23,23,23,0.08)", borderRadius: "4px" }} />
                        <div style={{ width: "280px", height: "14px", background: "rgba(23,23,23,0.05)", borderRadius: "4px" }} />
                    </div>
                </header>

                <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "24px" }}>
                    {Array.from({ length: 2 }).map((_, i) => (
                        <div
                            key={i}
                            className="skeletonPulse"
                            style={{
                                width: "100%",
                                height: "180px",
                                borderRadius: "24px",
                                background: "rgba(23, 23, 23, 0.03)",
                                border: "1px solid rgba(23, 23, 23, 0.05)"
                            }}
                        />
                    ))}
                </div>
            </section>
        </main>
    );
}
