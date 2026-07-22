import Image from "next/image";

export default function BuilderLoadingState() {
    return (
        <main className="builderShell builderLoadingShell" aria-busy="true" aria-label="Loading workspace">
            <div className="builderLoadingAmbient">
                <div className="builderLoadingGlow builderLoadingGlow1" />
                <div className="builderLoadingGlow builderLoadingGlow2" />
            </div>

            <div className="builderLoadingFramelessContainer">
                <div className="builderLoadingLogoHalo">
                    <div className="builderLoadingHaloRing" />
                    <div className="builderLoadingHaloRingOuter" />
                    <div className="builderLoadingLogoBadge">
                        <Image
                            src="/vilique-logo.png"
                            alt="Vilique"
                            width={28}
                            height={28}
                            className="builderLoadingLogo"
                            priority
                        />
                    </div>
                </div>

                <div className="builderLoadingCopy">
                    <h2 className="builderLoadingTitle">Opening builder</h2>
                    <p className="builderLoadingSubtitle">Preparing your invitation workspace</p>
                </div>

                <div className="builderLoadingProgressTrack">
                    <div className="builderLoadingProgressBar" />
                </div>
            </div>
        </main>
    );
}