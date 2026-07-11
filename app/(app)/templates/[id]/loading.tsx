import { ArrowLeft } from "lucide-react";

export default function TemplateDetailsLoading() {
    return (
        <main className="page templateDetailsPage">
            <header className="templateDetailTopbar">
                <div className="templateDetailCrumb" style={{ opacity: 0.5 }}>
                    <ArrowLeft size={16} />
                    <span>Back</span>
                </div>
            </header>

            <section className="templateDetailHero">
                <div
                    className="skeletonPulse"
                    style={{
                        flex: "1.2",
                        width: "100%",
                        height: "450px",
                        borderRadius: "28px",
                        background: "rgba(23, 23, 23, 0.03)"
                    }}
                />

                <div className="templateDetailContent" style={{ flex: "1", display: "flex", flexDirection: "column", gap: "20px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        <div style={{ width: "120px", height: "12px", background: "rgba(23,23,23,0.06)", borderRadius: "4px" }} />
                        <div style={{ width: "280px", height: "36px", background: "rgba(23,23,23,0.08)", borderRadius: "6px" }} />
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <div style={{ width: "100%", height: "14px", background: "rgba(23,23,23,0.05)", borderRadius: "4px" }} />
                        <div style={{ width: "90%", height: "14px", background: "rgba(23,23,23,0.05)", borderRadius: "4px" }} />
                        <div style={{ width: "60%", height: "14px", background: "rgba(23,23,23,0.05)", borderRadius: "4px" }} />
                    </div>

                    <div style={{ display: "flex", gap: "12px", marginTop: "10px" }}>
                        <div className="skeletonPulse" style={{ width: "140px", height: "46px", borderRadius: "14px", background: "rgba(23,23,23,0.06)" }} />
                        <div className="skeletonPulse" style={{ width: "140px", height: "46px", borderRadius: "14px", background: "rgba(23,23,23,0.04)" }} />
                    </div>
                </div>
            </section>
        </main>
    );
}
