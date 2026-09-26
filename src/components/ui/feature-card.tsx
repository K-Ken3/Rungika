import { clsx } from "clsx";
import type { LucideIcon } from "lucide-react";

export type FeatureItem = {
  icon: LucideIcon;
  title: string;
  description: string;
};

type FeatureCardProps = {
  item: FeatureItem;
  className?: string;
};

export function FeatureCard({ item, className }: FeatureCardProps) {
  const Icon = item.icon;
  return (
    <article className={clsx("feature-card", className)}>
      <span className="feature-icon">
        <Icon size={24} strokeWidth={1.9} aria-hidden="true" />
      </span>
      <h3>{item.title}</h3>
      <p>{item.description}</p>
    </article>
  );
}