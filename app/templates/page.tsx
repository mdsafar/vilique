import Link from "next/link";
import { Eye, Heart, Search, SlidersHorizontal, Sparkles } from "lucide-react";
import { getActiveTemplates } from "@/features/invitations/data";
import { InvitationCategory } from "@/types/invitation";

const categoryLabels: Record<InvitationCategory | "all", string> = {
    all: "All",
    wedding: "Wedding",
    birthday: "Birthday",
    engagement: "Engagement",
    housewarming: "Housewarming",
    baby_shower: "Baby Shower",
    graduation: "Graduation",
    party: "Party",
    corporate: "Corporate",
    festival: "Festival",
    custom: "Custom",
};

export default async function TemplatesPage() {
    const templates = await getActiveTemplates();
    const categories = ["all", ...Array.from(new Set(templates.map((t) => t.category)))] as const;

    return (
        <main className="page templatesPage">
            <section className="marketHeroPanel" aria-label="Template marketplace">
                <header className="marketHeader">
                    <div>
                        <p className="eyebrow">Template Marketplace</p>
                        <h1>
                            Choose your <span>invitation mood</span>
                        </h1>
                    </div>
                </header>

                <section className="marketSearch" aria-label="Template search and filters">
                    <label className="searchBox">
                        <Search size={18} aria-hidden="true" />
                        <input placeholder="Search wedding, birthday, corporate" />
                    </label>

                    <button type="button" className="filterButton" aria-label="Open filters">
                        <SlidersHorizontal size={19} aria-hidden="true" />
                    </button>
                </section>

                <section className="marketHeroStrip" aria-label="Featured template">
                    <div>
                        <span className="marketHeroBadge">
                            <Sparkles size={15} aria-hidden="true" />
                            Featured
                        </span>
                        <h2>Pastel Floral Wedding</h2>
                        <p>Soft glassmorphism, floating florals, RSVP, countdown, venue and music.</p>
                    </div>
                    <Link href="/templates/pastel-floral-wedding">View <span aria-hidden="true">→</span></Link>
                </section>
            </section>

            <nav className="categoryScroller" aria-label="Template categories">
                {categories.map((category) => (
                    <button className={category === "all" ? "active" : ""} key={category}>
                        {categoryLabels[category]}
                    </button>
                ))}
            </nav>

            <section className="templateGrid">
                {templates.map((template) => (
                    <article className="templateCard" key={template.id}>
                        <div className="templatePreviewContainer">
                            <Link href={`/templates/${template.id}`} aria-label={`View ${template.name}`}>
                                <div
                                    className="templatePreview"
                                    style={{ background: template.gradient }}
                                >
                                    <div className="templatePreviewGlass">
                                        <small>{categoryLabels[template.category]}</small>
                                        <span>{template.name}</span>
                                    </div>

                                    <div className="templateMiniSections" aria-hidden="true">
                                        {template.previewSections.slice(0, 3).map((section) => (
                                            <i key={section} />
                                        ))}
                                    </div>
                                </div>
                            </Link>

                            <button 
                                type="button" 
                                className="templateSaveBtn" 
                                aria-label={`Save ${template.name}`}
                            >
                                <Heart size={16} aria-hidden="true" />
                            </button>
                        </div>

                        <div className="templateInfo">
                            <div className="templateText">
                                <p className="templatePopularity">{template.popularity}</p>
                                <h2>{template.name}</h2>
                                <span className="templateMood">{template.mood}</span>
                            </div>

                            <div className="templateFooter">
                                <div className="paletteDots" aria-label={`${template.name} color palette`}>
                                    {template.palette.slice(0, 4).map((color) => (
                                        <i key={color} style={{ backgroundColor: color }} />
                                    ))}
                                </div>

                                <Link href={`/templates/${template.id}`}>
                                    <Eye size={16} aria-hidden="true" />
                                    Details
                                </Link>
                             </div>
                        </div>
                    </article>
                ))}
            </section>
        </main>
    );
}
