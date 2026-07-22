import Image from "next/image";
import { siteConfig } from "@/lib/config/site";

type AppLogoProps = {
  className?: string;
  size?: number;
  showText?: boolean;
  showMark?: boolean;
};

export default function AppLogo({
  className = "",
  size = 40,
  showText = true,
  showMark = true,
}: AppLogoProps) {
  return (
    <span className={`appLogo ${className}`.trim()}>
      {showMark ? (
        <Image
          className="appLogoMark"
          src="/vilique-logo.png"
          alt=""
          width={size}
          height={size}
          priority
        />
      ) : null}
      {showText ? <span className="appLogoText">{siteConfig.name}</span> : null}
    </span>
  );
}
