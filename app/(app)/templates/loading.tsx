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

                        <section className="marketSearch" style={{ margin: 0 }}>
                            <div className="searchBox" style={{ opacity: 0.6, width: "300px" }}>
                                <Search size={18} />
                                <div style={{ width: "120px", height: "14px", background: "rgba(0,0,0,0.06)", borderRadius: "4px" }} />
                            </div>
                        </section>
                    </div>

                    <nav className="categoryScroller" style={{ opacity: 0.6, background: "rgba(37, 22, 53, 0.04)", padding: "5px", borderRadius: "14px" }}>
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
                        <div className="templateInfo" style={{ padding: "14px 4px 4px" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                <div style={{ width: "80px", height: "12px", background: "rgba(23,23,23,0.06)", borderRadius: "4px" }} />
                                <div style={{ width: "160px", height: "18px", background: "rgba(23,23,23,0.08)", borderRadius: "4px" }} />
                            </div>
                        </div>
                    </article>
                ))}
            </section>
        </main>
    );
}
