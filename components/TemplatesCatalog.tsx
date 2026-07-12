"use client";

import { useState } from "react";
import Link from "next/link";
import { Heart, Search } from "lucide-react";
import AppLogo from "@/components/AppLogo";
import type { InvitationCategory } from "@/types/invitation";

type TemplateItem = {
    id: string;
    name: string;
    category: InvitationCategory;
    accent: string;
    gradient: string;
    description: string;
    mood: string;
    badge: "Free" | "Premium";
    popularity: "Featured" | "Popular" | "Newest";
    features: string[];
    palette: string[];
};

type Props = {
    templates: TemplateItem[];
};

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

export default function TemplatesCatalog({ templates }: Props) {
    const [searchTerm, setSearchTerm] = useState("");
    const [activeCategory, setActiveCategory] = useState<InvitationCategory | "all">("all");
    const categories = ["all", ...Array.from(new Set(templates.map((template) => template.category)))] as const;
    const query = searchTerm.trim().toLowerCase();
    const filteredTemplates = templates.filter((template) => {
        const matchesCategory = activeCategory === "all" || template.category === activeCategory;
        const searchable = [
            template.name,
            template.description,
            template.mood,
            template.category.replace("_", " "),
            template.popularity,
        ].join(" ").toLowerCase();

        return matchesCategory && (!query || searchable.includes(query));
    });

    return (
        <>
            <section className="marketHeroPanel" aria-label="Template marketplace">
                <header className="marketHeader">
                    <div className="templatesAppHeader" aria-label="Vilique">
                        <Link href="/templates" className="templatesBrand">
                            <AppLogo size={34} />
                        </Link>
                    </div>

                    <div className="marketHeaderTop">
                        <div>
                            <p className="eyebrow">Template Marketplace</p>
                            <h1>
                                Choose your <span>invitation mood</span>
                            </h1>
                        </div>

                        <section className="marketSearch" aria-label="Template search">
                            <label className="searchBox">
                                <Search size={18} aria-hidden="true" />
                                <input
                                    value={searchTerm}
                                    onChange={(event) => setSearchTerm(event.target.value)}
                                    placeholder="Search floral, pastel"
                                />
                            </label>
                        </section>
                    </div>

                    <nav className="categoryScroller" aria-label="Template categories">
                        {categories.map((category) => (
                            <button
                                className={category === activeCategory ? "active" : ""}
                                key={category}
                                type="button"
                                onClick={() => setActiveCategory(category)}
                            >
                                {categoryLabels[category]}
                            </button>
                        ))}
                    </nav>
                </header>
            </section>

            {filteredTemplates.length ? (
                <section className="templateGrid">
                    {filteredTemplates.map((template) => {
                        const details = [template.popularity, categoryLabels[template.category], template.badge];
                        const featureChips = template.features.slice(0, 3);

                        return (
                            <article className="templateCard" key={template.id}>
                                <Link
                                    href={`/templates/${template.id}`}
                                    className="templateCardLink"
                                    aria-label={`View ${template.name}`}
                                >
                                    <div className="templatePreviewContainer">
                                        <div
                                            className="templatePreview templatePreviewReference"
                                            style={{ background: template.gradient }}
                                        >
                                            <div className="templateReferenceCard">
                                                <small>WEDDING INVITATION</small>
                                                <strong>Maya & Arjun</strong>
                                                <span>FEB 14 · 05:30 PM</span>
                                            </div>
                                            <i className="templateFlower flowerOne" />
                                            <i className="templateFlower flowerTwo" />
                                        </div>
                                    </div>

                                    <div className="templateInfo">
                                        <div className="templateText">
                                            <p className="templatePopularity">{details.join(" · ")}</p>
                                            <h2>{template.name}</h2>
                                            <span className="templateMood">{template.mood}</span>
                                            <div className="templateFeatureChips" aria-label={`${template.name} features`}>
                                                {featureChips.map((feature) => (
                                                    <span key={feature}>{feature}</span>
                                                ))}
                                            </div>
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
                            </article>
                        );
                    })}
                </section>
            ) : (
                <section className="templateNoResults">
                    <h2>No templates found</h2>
                    <p>Try searching for wedding, floral, or pastel.</p>
                    <button
                        type="button"
                        onClick={() => {
                            setSearchTerm("");
                            setActiveCategory("all");
                        }}
                    >
                        Reset filters
                    </button>
                </section>
            )}
        </>
    );
}
