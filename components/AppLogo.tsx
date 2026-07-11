import Image from "next/image";
import { siteConfig } from "@/lib/config/site";

type AppLogoProps = {
  className?: string;
  size?: number;
  showText?: boolean;
};

export default function AppLogo({
  className = "",
  size = 34,
  showText = true,
}: AppLogoProps) {
  return (
    <span className={`appLogo ${className}`.trim()}>
      <Image
        className="appLogoMark"
        src="/vilique-logo.png"
        alt=""
        width={size}
        height={size}
        priority
      />
      {showText ? <span className="appLogoText">{siteConfig.name}</span> : null}
    </span>
  );
}
