import { Search } from "lucide-react";

export default function TemplatesLoading() {
    return (
        <main className="page templatesPage">
            <section className="marketHeroPanel" style={{ pointerEvents: "none" }}>
                <header className="marketHeader">
                    <div className="marketHeaderTop">
                        <div>
                            <div className="skeletonLine eyebrow" style={{ width: "120px", height: "14px", marginBottom: "8px", background: "rgba(23,23,23,0.06)", borderRadius: "4px" }} />
                            <div className="skeletonLine" style={{ width: "240px", height: "32px", background: "rgba(23,23,23,0.08)", borderRadius: "6px" }} />
                        </div>

                        <section className="marketSearch">
                            <div className="searchBox skeletonPulse" style={{ opacity: 0.6 }}>
                                <Search size={18} aria-hidden="true" />
                                <div className="skeletonPulse" style={{ width: "120px", height: "14px", background: "rgba(23,23,23,0.06)", borderRadius: "4px" }} />
                            </div>
                        </section>
                    </div>

                    <nav className="categoryScroller" style={{ opacity: 0.6 }}>
                        {Array.from({ length: 2 }).map((_, i) => (
                            <span
                                key={i}
                                className="skeletonPulse"
                                style={{
                                    display: "inline-block",
                                    width: i === 0 ? "48px" : "84px",
                                    height: "34px",
                                    borderRadius: "10px",
                                    background: "rgba(255, 255, 255, 0.7)",
                                    boxShadow: i === 0 ? "0 2px 6px rgba(0,0,0,0.04)" : "none",
                                }}
                            />
                        ))}
                    </nav>
                </header>
            </section>

            <section className="templateGrid">
                {Array.from({ length: 6 }).map((_, i) => (
                    <article className="templateCard" key={i}>
                        <div className="templatePreviewContainer">
                            <div
                                className="templatePreview skeletonPulse"
                                style={{
                                    background: "linear-gradient(135deg, #f3f3f5, #eaeaed)",
                                    minHeight: "220px",
                                    borderRadius: "20px"
                                }}
                            />
                        </div>
                        <div className="templateInfo">
                            <div className="templateText" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                <div className="skeletonPulse" style={{ width: "80px", height: "12px", background: "rgba(23,23,23,0.06)", borderRadius: "4px" }} />
                                <div className="skeletonPulse" style={{ width: "160px", height: "18px", background: "rgba(23,23,23,0.08)", borderRadius: "4px" }} />
                                <div className="skeletonPulse" style={{ width: "120px", height: "14px", background: "rgba(23,23,23,0.05)", borderRadius: "4px" }} />
                            </div>
                            <div className="templateFooter" style={{ marginTop: "12px" }}>
                                <div className="paletteDots">
                                    {Array.from({ length: 3 }).map((_, dotIdx) => (
                                        <i key={dotIdx} className="skeletonPulse" style={{ backgroundColor: "rgba(23,23,23,0.05)", width: "16px", height: "16px", borderRadius: "50%", display: "inline-block" }} />
                                    ))}
                                </div>
                                <div className="skeletonPulse" style={{ width: "80px", height: "24px", borderRadius: "12px", background: "rgba(23,23,23,0.06)" }} />
                            </div>
                        </div>
                    </article>
                ))}
            </section>
        </main>
    );
}
