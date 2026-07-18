import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
    ArrowLeft,
    CheckCircle2,
    Clock3,
    Heart,
    Palette,
    MapPin,
    MoreHorizontal,
    Music,
    Phone,
    Sparkles,
    Star,
    Type,
    Wand2,
} from "lucide-react";
import TemplateDetailPreview from "@/components/templates/TemplateDetailPreview";
import TemplateLivePreviewLink from "@/components/TemplateLivePreviewLink";
import UseTemplateButton from "@/components/UseTemplateButton";
import { getActiveTemplates } from "@/features/invitations/data";
import { formatTemplateRating } from "@/lib/templateRatingFormat";
import { InvitationCategory } from "@/types/invitation";

type Props = {
    params: Promise<{
        id: string;
    }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    const templates = await getActiveTemplates();
    const template = templates.find((item) => item.id === id);

    return {
        title: template?.name || "Template",
        description: template?.description || "Preview a Vilique invitation template.",
    };
}

const categoryLabels: Record<InvitationCategory, string> = {
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

export default async function TemplateDetailsPage({ params }: Props) {
    const { id } = await params;
    const templates = await getActiveTemplates();
    const template = templates.find((item) => item.id === id);

    if (!template) {
        notFound();
    }

    const ratingSummary = {
        average: template.ratingAverage ?? null,
        count: template.ratingCount ?? 0,
    };
    const ratingLabel = formatTemplateRating(ratingSummary);
    const detailBadge = getTemplateDetailBadge(template);

    return (
        <main className="page templateDetailsPage">
            <header className="templateDetailTopbar analyticsHeader">
                <div className="templateDetailCrumb">
                    <Link aria-label="Back to templates" className="analyticsBackBtn" href="/">
                        <ArrowLeft size={16} aria-hidden="true" />
                        <span>Templates</span>
                    </Link>
                </div>

                <div className="analyticsHeaderText">
                    <h1>{template.name}</h1>
                    <p>Template details</p>
                </div>

                <div className="analyticsHeaderSpacer" aria-hidden="true" />
            </header>

            <section className="templateDetailHero">
                <TemplateDetailPreview
                    template={template}
                    categoryLabel={categoryLabels[template.category]}
                />

                <div className="templateDetailContent">
                    <div className="templateDetailHeader">
                        <p className="eyebrow">Template Details</p>
                        <h1>{template.name}</h1>
                        <div className="detailRating" aria-label={`Template rating: ${ratingLabel}`}>
                            {ratingSummary.count ? (
                                <>
                                    <span aria-hidden="true">
                                        {Array.from({ length: 5 }).map((_, index) => (
                                            <Star
                                                fill={ratingSummary.average !== null && index < Math.round(ratingSummary.average) ? "currentColor" : "none"}
                                                key={index}
                                                size={16}
                                            />
                                        ))}
                                    </span>
                                    <strong>{ratingSummary.average?.toFixed(1)}</strong>
                                    <p>({ratingSummary.count})</p>
                                </>
                            ) : (
                                <>
                                    <span aria-hidden="true">
                                        <Star size={16} />
                                    </span>
                                    <strong>New</strong>
                                    <p>No ratings yet</p>
                                </>
                            )}
                        </div>
                    </div>

                    <p className="detailLead">{template.description}</p>

                    <div className="detailBadges">
                        <span className={detailBadge.className}>
                            {detailBadge.label}
                        </span>
                        <span>Animated</span>
                        <span>Mobile First</span>
                    </div>

                    <div className="heroActions detailActions">
                        <UseTemplateButton templateId={template.id} />

                        <TemplateLivePreviewLink templateId={template.id} />
                    </div>

                    <div className="detailBlock">
                        <h2>What&apos;s Included</h2>
                        <div className="detailFeatureGrid">
                            <span><Sparkles size={17} aria-hidden="true" />Animated flowers</span>
                            <span><Clock3 size={17} aria-hidden="true" />Countdown timer</span>
                            <span><Music size={17} aria-hidden="true" />RSVP</span>
                            <span><MapPin size={17} aria-hidden="true" />Google Maps</span>
                            <span><Music size={17} aria-hidden="true" />Music</span>
                            <span><Heart size={17} aria-hidden="true" />Thank You screen</span>
                            <span><MoreHorizontal size={17} aria-hidden="true" />And more</span>
                        </div>
                    </div>

                    <div className="detailPerfectFor">
                        <h2>Perfect For</h2>
                        <div className="detailPerfectForOptions">
                            <span><Heart size={17} aria-hidden="true" />Wedding</span>
                            <span><Sparkles size={17} aria-hidden="true" />Engagement</span>
                            <span><Music size={17} aria-hidden="true" />Reception</span>
                        </div>
                    </div>

                    <div className="detailCustomizable">
                        <div>
                            <h2>Fully Customizable</h2>
                            <p>Change colors, fonts, images, music, text, animations and sections anytime in the builder.</p>
                        </div>
                        <div className="detailCustomIcons" aria-hidden="true">
                            <span>
                                <Palette size={26} />
                                {template.palette.slice(0, 4).map((color) => (
                                    <i key={color} style={{ backgroundColor: color }} />
                                ))}
                            </span>
                            <b><Type size={30} /></b>
                        </div>
                    </div>

                    <TemplateSupport className="templateDetailSupport templateDetailSupport--mobile" />
                </div>
            </section>

            <TemplateSupport className="templateDetailSupport templateDetailSupport--desktop" />
        </main>
    );
}

function getTemplateDetailBadge(template: { id: string; popularity: string; badge: string }) {
    if (template.id === "pastel-floral-wedding") {
        return {
            label: "Featured",
            className: "featuredBadge",
        };
    }

    return template.badge === "Premium"
        ? { label: "Premium", className: "premiumBadge" }
        : { label: template.popularity, className: "featuredBadge" };
}

function TemplateSupport({ className }: { className: string }) {
    return (
        <section className={className} aria-label="Template composition">
            <article>
                <span>
                    <Phone size={28} aria-hidden="true" />
                </span>
                <b>01</b>
                <div>
                    <h2>Invitation screen</h2>
                    <p>Names, date, venue, countdown and RSVP controls use the real mobile preview.</p>
                </div>
            </article>
            <article>
                <span>
                    <CheckCircle2 size={30} aria-hidden="true" />
                </span>
                <b>02</b>
                <div>
                    <h2>Thank-you screen</h2>
                    <p>The accepted state is previewed beside the invite so the full flow is easy to visualize.</p>
                </div>
            </article>
            <article>
                <span>
                    <Wand2 size={30} aria-hidden="true" />
                </span>
                <b>03</b>
                <div>
                    <h2>Builder ready</h2>
                    <p>The template opens directly in the builder with Supabase draft saved.</p>
                </div>
            </article>
        </section>
    );
}
