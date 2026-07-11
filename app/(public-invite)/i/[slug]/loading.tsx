import { Heart } from "lucide-react";

export default function PublicInviteLoading() {
    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                background: "#fff8f3",
                color: "#b99aad",
                gap: "16px"
            }}
        >
            <div
                style={{
                    animation: "pulse 1.5s ease-in-out infinite",
                    display: "grid",
                    placeItems: "center"
                }}
            >
                <Heart size={42} fill="currentColor" style={{ opacity: 0.8 }} />
            </div>
            <p
                style={{
                    fontSize: "13px",
                    fontWeight: 750,
                    textTransform: "uppercase",
                    letterSpacing: "0.15em",
                    opacity: 0.6,
                    margin: 0
                }}
            >
                Loading Invitation
            </p>

            <style>{`
                @keyframes pulse {
                    0%, 100% { transform: scale(1); opacity: 0.7; }
                    50% { transform: scale(1.18); opacity: 1; }
                }
            `}</style>
        </div>
    );
}
