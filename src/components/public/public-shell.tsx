import type { ReactNode } from "react";
import { PublicHeader } from "./public-header";
import { PublicFooter } from "./public-footer";

type PublicShellProps = {
  children: ReactNode;
};

export function PublicShell({ children }: PublicShellProps) {
  return (
    <>
      <PublicHeader />
      <main id="main-content">{children}</main>
      <PublicFooter />
    </>
  );
}