import Image from "next/image";
import { clsx } from "clsx";

export const LOGO_WIDTH = 1983;
export const LOGO_HEIGHT = 793;

type BrandLogoProps = {
  className?: string;
  priority?: boolean;
};

export function BrandLogo({ className, priority = false }: BrandLogoProps) {
  return (
    <span className={clsx("brand-logo", className)}>
      <Image
        src="/brand/rungika-logo.png"
        alt="Rungika"
        width={LOGO_WIDTH}
        height={LOGO_HEIGHT}
        priority={priority}
        sizes="(min-width: 900px) 168px, 240px"
        style={{ width: "100%", height: "auto" }}
      />
    </span>
  );
}