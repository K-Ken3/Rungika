import type { ReactNode } from "react";
import { Container } from "@/components/ui/container";

type PageHeroProps = {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
};

export function PageHero({ eyebrow, title, description }: PageHeroProps) {
  return (
    <section className="page-hero">
      <Container>
        <div className="page-hero-inner">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          {description ? <p className="lead">{description}</p> : null}
        </div>
      </Container>
    </section>
  );
}