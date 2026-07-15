import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type Section = {
    id: string;
    title: string;
    body: React.ReactNode;
};

export const policyMeta = {
    effectiveDate:
        process.env.VILIQUE_POLICY_EFFECTIVE_DATE || "15 July 2026",

    lastUpdated:
        process.env.VILIQUE_POLICY_LAST_UPDATED || "15 July 2026",

    supportEmail:
        process.env.VILIQUE_SUPPORT_EMAIL ||
        process.env.NEXT_PUBLIC_SUPPORT_EMAIL ||
        "support@vilique.com",

    legalEntityName:
        process.env.VILIQUE_LEGAL_ENTITY_NAME ||
        "Muhammed Safar",

    businessAddress:
        process.env.VILIQUE_BUSINESS_ADDRESS ||
        "Kerala, India",

    grievanceContact:
        process.env.VILIQUE_GRIEVANCE_CONTACT ||
        process.env.VILIQUE_SUPPORT_EMAIL ||
        process.env.NEXT_PUBLIC_SUPPORT_EMAIL ||
        "support@vilique.com",

    jurisdiction:
        process.env.VILIQUE_JURISDICTION ||
        "India",
};

export function LegalPage({
    title,
    description,
    sections,
}: {
    title: string;
    description: string;
    sections: Section[];
}) {
    return (
        <main className="legalPage">
            <header className="legalHero">
                <Link href="/templates" className="legalBack">
                    <ArrowLeft size={16} aria-hidden="true" />
                    <span>Back to Vilique</span>
                </Link>
                <h1>{title}</h1>
                <p>{description}</p>
                <dl className="legalMeta">
                    <div>
                        <dt>Effective</dt>
                        <dd>{policyMeta.effectiveDate}</dd>
                    </div>
                    <div>
                        <dt>Last updated</dt>
                        <dd>{policyMeta.lastUpdated}</dd>
                    </div>
                </dl>
            </header>

            <div className="legalBodyShell">
                <nav className="legalToc" aria-label={`${title} contents`}>
                    {sections.map((section) => (
                        <a href={`#${section.id}`} key={section.id}>{section.title}</a>
                    ))}
                </nav>

                <div className="legalContentShell">
                    <article className="legalContent">
                        <p className="legalNotice">
                            This page is drafted for Vilique production readiness and must be reviewed by qualified legal counsel before launch.
                        </p>
                        {sections.map((section, index) => (
                            <section id={section.id} key={section.id}>
                                <span className="legalSectionNumber" aria-hidden="true">
                                    {(index + 1).toString().padStart(2, "0")}
                                </span>
                                <div className="legalSectionBody">
                                    <h2>{section.title}</h2>
                                    {section.body}
                                </div>
                            </section>
                        ))}
                    </article>
                </div>
            </div>
        </main>
    );
}

export function LegalFooter() {
    return (
        <footer className="siteFooter">
            <nav aria-label="Vilique policies">
                <Link href="/terms">Terms</Link>
                <Link href="/privacy">Privacy</Link>
                <Link href="/refund-policy">Refund Policy</Link>
                <Link href="/pricing">Pricing</Link>
                <Link href="/contact">Contact</Link>
                <Link href="/about">About</Link>
            </nav>
        </footer>
    );
}
