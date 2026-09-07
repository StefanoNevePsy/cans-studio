import type { ReactNode } from "react";

export function TabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`tab-button ${active ? "is-active" : ""}`}
      onClick={onClick}
      role="tab"
      aria-selected={active}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
