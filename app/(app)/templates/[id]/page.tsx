import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
    ArrowLeft,
    CheckCircle2,
    Clock3,
    Eye,
    Heart,
    ImageIcon,
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
import UseTemplateButton from "@/components/UseTemplateButton";
import { getActiveTemplates } from "@/features/invitations/data";
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

const usageDetails: Record<string, {
    rating: string;
    used: string;
    setup: string;
    flow: string;
}> = {
    "pastel-floral-wedding": {
        rating: "4.9/5 rating",
        used: "1.2k+ uses",
        setup: "5 min setup",
        flow: "RSVP ready",
    },
};

export default async function TemplateDetailsPage({ params }: Props) {
    const { id } = await params;
    const templates = await getActiveTemplates();
    const template = templates.find((item) => item.id === id);

    if (!template) {
        notFound();
    }

    const usage = usageDetails[template.id] ?? {
        rating: "4.8/5 rating",
        used: `${template.popularity} template`,
        setup: "Quick setup",
        flow: "Flow ready",
    };

    return (
        <main className="page templateDetailsPage">
            <header className="templateDetailTopbar">
                <div className="templateDetailCrumb">
                    <Link aria-label="Back to templates" href="/templates">
                        <ArrowLeft size={16} aria-hidden="true" />
                        <span>Templates</span>
                    </Link>
                </div>

                <button className="templateDetailSelect" type="button">
                    {categoryLabels[template.category]} template
                </button>
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
                        <div className="detailRating" aria-label={usage.rating}>
                            <span aria-hidden="true">
                                {Array.from({ length: 5 }).map((_, index) => (
                                    <Star fill="currentColor" key={index} size={16} />
                                ))}
                            </span>
                            <strong>4.9</strong>
                            <p>(1.2k uses)</p>
                        </div>
                    </div>

                    <p className="detailLead">{template.description}</p>

                    <div className="detailBadges">
                        <span className={template.badge === "Premium" ? "premiumBadge" : "freeBadge"}>
                            {template.badge}
                        </span>
                        <span>Animated</span>
                        <span>Mobile First</span>
                    </div>

                    <div className="heroActions detailActions">
                        <UseTemplateButton templateId={template.id} />

                        <Link className="secondaryBtn" href={`/templates/${template.id}/preview`}>
                            <Eye size={17} aria-hidden="true" />
                            Live Preview
                        </Link>
                    </div>

                    <div className="detailBlock">
                        <h2>What&apos;s Included</h2>
                        <div className="detailFeatureGrid">
                            <span><Sparkles size={17} aria-hidden="true" />Animated flowers</span>
                            <span><Clock3 size={17} aria-hidden="true" />Countdown timer</span>
                            <span><Music size={17} aria-hidden="true" />RSVP</span>
                            <span><MapPin size={17} aria-hidden="true" />Google Maps</span>
                            <span><Music size={17} aria-hidden="true" />Music</span>
                            <span><ImageIcon size={17} aria-hidden="true" />Photo Gallery</span>
                            <span><Phone size={17} aria-hidden="true" />Story Timeline</span>
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
                </div>
            </section>

            <section className="templateDetailSupport" aria-label="Template composition">
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
        </main>
    );
}
