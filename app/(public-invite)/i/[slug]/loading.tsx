import { Heart } from "lucide-react";

export default function PublicInviteLoading() {
    return (
        <main className="publicInvitationWrapper" aria-busy="true">
            <div className="templateLoaderOverlay pastelWeddingPage">
                <div className="templateLoaderCard">
                    <div className="templateLoaderRings">
                        <div className="ring1" />
                        <div className="ring2" />
                        <div className="heartCenter">
                            <Heart size={22} strokeWidth={1.7} fill="currentColor" aria-hidden="true" />
                        </div>
                    </div>
                    
                    <p className="loaderCoupleName">
                        Loading Invitation
                    </p>
                    
                    <p className="loaderStatusText">
                        Opening Celebration
                    </p>
                    <div className="loaderLine" />
                </div>
            </div>
        </main>
    );
}
