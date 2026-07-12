import { useCallback, useState } from "react";

type RazorpayWindow = Window & {
    Razorpay?: unknown;
};

export function useRazorpay() {
    const [isLoading, setIsLoading] = useState(false);

    const loadScript = useCallback((): Promise<boolean> => {
        return new Promise((resolve) => {
            if (typeof window === "undefined") {
                resolve(false);
                return;
            }
            if ((window as RazorpayWindow).Razorpay) {
                resolve(true);
                return;
            }
            setIsLoading(true);
            const script = document.createElement("script");
            script.src = "https://checkout.razorpay.com/v1/checkout.js";
            script.async = true;
            script.onload = () => {
                setIsLoading(false);
                resolve(true);
            };
            script.onerror = () => {
                setIsLoading(false);
                resolve(false);
            };
            document.body.appendChild(script);
        });
    }, []);

    return { loadScript, isLoading };
}
