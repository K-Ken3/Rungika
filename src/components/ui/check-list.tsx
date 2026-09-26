import { Check } from "lucide-react";
import { clsx } from "clsx";

type CheckListProps = {
  items: string[];
  className?: string;
  columns?: 1 | 2;
};

export function CheckList({ items, className, columns = 1 }: CheckListProps) {
  return (
    <ul className={clsx("check-list", className)} style={columns === 2 ? { gridTemplateColumns: "1fr 1fr" } : undefined}>
      {items.map((item) => (
        <li key={item}>
          <span className="check-icon">
            <Check size={14} strokeWidth={3} aria-hidden="true" />
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}