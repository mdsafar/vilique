import Link from "next/link";
import { ArrowLeft, FileQuestion, Grid3X3, Mail, Search } from "lucide-react";
import AppLogo from "@/components/AppLogo";

export default function NotFound() {
    return (
        <main className="notFoundPage">
            <section className="notFoundPanel" aria-labelledby="not-found-title">
                <header className="notFoundHeader">
                    <AppLogo size={28} />
                    <span>404</span>
                </header>

                <div className="notFoundIcon" aria-hidden="true">
                    <FileQuestion size={34} />
                </div>

                <div className="notFoundCopy">
                    <p>404 error</p>
                    <h1 id="not-found-title">Page not found</h1>
                    <span>
                        The link may be mistyped, moved, expired, or no longer available.
                    </span>
                </div>

                <div className="notFoundActions" aria-label="Helpful places to continue">
                    <Link className="notFoundPrimaryAction" href="/">
                        <Grid3X3 size={17} aria-hidden="true" />
                        Browse templates
                    </Link>
                    <Link className="notFoundAction" href="/invitations">
                        <Mail size={17} aria-hidden="true" />
                        My invitations
                    </Link>
                </div>

                <div className="notFoundHints" aria-label="What to check">
                    <span>
                        <Search size={14} aria-hidden="true" />
                        Check the URL spelling
                    </span>
                    <span>
                        <ArrowLeft size={14} aria-hidden="true" />
                        Ask the host for a fresh link
                    </span>
                </div>
            </section>
        </main>
    );
}
