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
                background:
                    "radial-gradient(ellipse at 0% 0%, rgba(200, 160, 220, 0.35) 0%, transparent 45%), radial-gradient(ellipse at 50% 100%, rgba(240, 180, 200, 0.4) 0%, transparent 50%), linear-gradient(135deg, #f5eaff 0%, #ecdcf7 35%, #fce8f0 70%, #e8f4ff 100%)",
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
