import { ArrowLeft } from "lucide-react";

export default function TemplateDetailsLoading() {
    return (
        <main className="page templateDetailsPage">
            <header className="templateDetailTopbar">
                <div className="templateDetailCrumb" style={{ opacity: 0.5 }}>
                    <ArrowLeft size={16} />
                    <span>Templates</span>
                </div>

                <div className="skeletonPulse" style={{ width: "120px", height: "36px", borderRadius: "10px", background: "rgba(23, 23, 23, 0.05)" }} />
            </header>

            <section className="templateDetailHero">
                <div
                    className="templateDetailPreview skeletonPulse"
                    style={{
                        flex: "1.2",
                        width: "100%",
                        height: "500px",
                        background: "rgba(23, 23, 23, 0.03)"
                    }}
                />

                <div className="templateDetailContent">
                    <div className="templateDetailHeader">
                        <div className="skeletonPulse eyebrow" style={{ width: "100px", height: "11px", background: "rgba(23,23,23,0.06)", borderRadius: "4px", marginBottom: "8px" }} />
                        <div className="skeletonPulse" style={{ width: "280px", height: "36px", background: "rgba(23,23,23,0.08)", borderRadius: "6px" }} />
                        <div className="detailRating" style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "10px" }}>
                            <div className="skeletonPulse" style={{ width: "80px", height: "16px", background: "rgba(23,23,23,0.05)", borderRadius: "4px" }} />
                            <div className="skeletonPulse" style={{ width: "60px", height: "14px", background: "rgba(23,23,23,0.04)", borderRadius: "4px" }} />
                        </div>
                    </div>

                    <div className="detailLead" style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "16px" }}>
                        <div className="skeletonPulse" style={{ width: "100%", height: "14px", background: "rgba(23,23,23,0.05)", borderRadius: "4px" }} />
                        <div className="skeletonPulse" style={{ width: "90%", height: "14px", background: "rgba(23,23,23,0.05)", borderRadius: "4px" }} />
                        <div className="skeletonPulse" style={{ width: "60%", height: "14px", background: "rgba(23,23,23,0.05)", borderRadius: "4px" }} />
                    </div>

                    <div className="detailBadges" style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
                        <div className="skeletonPulse" style={{ width: "70px", height: "24px", background: "rgba(23,23,23,0.05)", borderRadius: "999px" }} />
                        <div className="skeletonPulse" style={{ width: "65px", height: "24px", background: "rgba(23,23,23,0.05)", borderRadius: "999px" }} />
                        <div className="skeletonPulse" style={{ width: "80px", height: "24px", background: "rgba(23,23,23,0.05)", borderRadius: "999px" }} />
                    </div>

                    <div className="heroActions detailActions" style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
                        <div className="skeletonPulse" style={{ width: "150px", height: "46px", borderRadius: "14px", background: "rgba(23,23,23,0.06)" }} />
                        <div className="skeletonPulse" style={{ width: "150px", height: "46px", borderRadius: "14px", background: "rgba(23,23,23,0.04)" }} />
                    </div>
                </div>
            </section>

            <section className="templateDetailSupport" aria-label="Template composition" style={{ pointerEvents: "none", opacity: 0.6 }}>
                {Array.from({ length: 3 }).map((_, i) => (
                    <article key={i}>
                        <span className="skeletonPulse" style={{ width: "48px", height: "48px", borderRadius: "50%", background: "rgba(23,23,23,0.05)", flexShrink: 0 }} />
                        <div className="skeletonPulse" style={{ width: "20px", height: "20px", background: "rgba(23,23,23,0.05)", borderRadius: "4px" }} />
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
                            <div className="skeletonPulse" style={{ width: "120px", height: "18px", background: "rgba(23,23,23,0.06)", borderRadius: "4px" }} />
                            <div className="skeletonPulse" style={{ width: "100%", height: "14px", background: "rgba(23,23,23,0.04)", borderRadius: "4px" }} />
                        </div>
                    </article>
                ))}
            </section>
        </main>
    );
}
