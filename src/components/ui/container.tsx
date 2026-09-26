import { clsx } from "clsx";
import type { ComponentProps } from "react";

type ContainerProps = ComponentProps<"div">;

export function Container({ className, ...props }: ContainerProps) {
  return <div className={clsx("container", className)} {...props} />;
}