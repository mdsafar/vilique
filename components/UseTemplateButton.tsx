"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";

export default function UseTemplateButton({ templateId }: { templateId: string }) {
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleUse = () => {
        setIsLoading(true);
        router.push(`/builder?template=${templateId}&from=template-details`);
    };

    return (
        <button
            type="button"
            className="primaryBtn"
            onClick={handleUse}
            disabled={isLoading}
            style={{ 
                cursor: isLoading ? "not-allowed" : "pointer",
                border: "none",
                outline: "none",
                fontFamily: "inherit",
            }}
        >
            {isLoading ? (
                <>
                    <Loader2 size={17} className="spinner" aria-hidden="true" />
                    <span>Loading...</span>
                </>
            ) : (
                <>
                    <Sparkles size={17} aria-hidden="true" />
                    <span>Use Template</span>
                </>
            )}
        </button>
    );
}
