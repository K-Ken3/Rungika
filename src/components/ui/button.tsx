import Link from "next/link";
import { clsx } from "clsx";
import type { ComponentProps } from "react";

type ButtonLinkProps = {
  variant?: "primary" | "secondary" | "ghost" | "green" | "on-teal";
  size?: "sm" | "md" | "lg";
  className?: string;
} & Omit<ComponentProps<typeof Link>, "className">;

export function ButtonLink({ variant = "primary", size = "md", className, ...props }: ButtonLinkProps) {
  return <Link className={clsx("btn", `btn-${variant}`, `btn-${size}`, className)} {...props} />;
}