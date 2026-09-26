import { CircleCheck } from "lucide-react";

export function DashboardPreview() {
  return (
    <div
      className="hero-visual"
      role="img"
      aria-label="Stylised illustration of a Rungika operations dashboard with a collections chart, a schedule list, and a payment-verified notice."
    >
      <div className="mock-window">
        <div className="mock-titlebar">
          <span className="mock-dots">
            <span />
            <span />
            <span />
          </span>
          <span className="mock-title">Operations overview</span>
          <span className="mock-status">
            <span className="status-dot" />
            Workspace active
          </span>
        </div>
        <div className="mock-grid">
          <div className="mock-card">
            <span className="mock-label">Collections this month</span>
            <div className="mock-bars">
              <span className="mock-bar" />
              <span className="mock-bar" />
              <span className="mock-bar" />
              <span className="mock-bar" />
              <span className="mock-bar" />
              <span className="mock-bar" />
            </div>
          </div>
          <div className="mock-col">
            <div className="mock-card">
              <span className="mock-label">This week</span>
              <div className="mock-rows">
                <span className="mock-row" />
                <span className="mock-row" />
                <span className="mock-row" />
                <span className="mock-row" />
              </div>
            </div>
            <div className="mock-card">
              <span className="mock-label">Open tasks</span>
              <div className="mock-rows">
                <span className="mock-row" />
                <span className="mock-row" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mock-float">
        <span className="float-check">
          <CircleCheck size={18} strokeWidth={2.4} aria-hidden="true" />
        </span>
        <span>Payment recorded</span>
      </div>
    </div>
  );
}