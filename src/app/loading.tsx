import { BrandLogo } from "@/components/brand/logo";

export default function Loading() {
  return (
    <div className="route-loader" role="status" aria-live="polite">
      <span className="route-loader-mark">
        <BrandLogo className="route-loader-logo" />
      </span>
      <span className="route-loader-bar" aria-hidden="true" />
      <span className="visually-hidden">Loading page</span>
    </div>
  );
}
