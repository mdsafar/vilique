"use client";

import AuthRequiredModal from "@/components/AuthRequiredModal";

type BuilderAuthRequiredStateProps = {
    templateKey: string;
};

export default function BuilderAuthRequiredState({
    templateKey,
}: BuilderAuthRequiredStateProps) {
    return (
        <main className="builderShell">
            <AuthRequiredModal
                next={`/builder?template=${templateKey}`}
                forceOpen
            />
        </main>
    );
}