"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, Heart, Search, Sparkles } from "lucide-react";
import type { InvitationCategory } from "@/types/invitation";

type TemplateItem = {
    id: string;
    name: string;
    category: InvitationCategory;
    accent: string;
    gradient: string;
    description: string;
    mood: string;
    popularity: "Featured" | "Popular" | "Newest";
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
                    {filteredTemplates.map((template) => (
                        <article className="templateCard" key={template.id}>
                            <div className="templatePreviewContainer">
                                <Link href={`/templates/${template.id}`} aria-label={`View ${template.name}`}>
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
