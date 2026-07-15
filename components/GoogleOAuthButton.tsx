"use client";

import Image from "next/image";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

type Props = {
    disabled?: boolean;
};

export default function GoogleOAuthButton({ disabled = false }: Props) {
    const { pending } = useFormStatus();
    const isDisabled = disabled || pending;

    return (
        <button className="oauthButton" type="submit" disabled={isDisabled} aria-busy={pending}>
            {pending ? (
                <Loader2 className="spinner" size={20} aria-hidden="true" />
            ) : (
                <Image className="googleMark" src="/google-logo.png" alt="" width={24} height={24} aria-hidden="true" />
            )}
            {pending ? "Connecting..." : "Continue with Google"}
        </button>
    );
}
