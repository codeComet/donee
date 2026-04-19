import React from "react";
import { cn } from "@/lib/utils";

const priorityConfig = {
  critical: {
    label: "Critical",
    className: "bg-red-100 text-red-700 border-red-200",
  },
  high: {
    label: "High",
    className: "bg-orange-100 text-orange-700 border-orange-200",
  },
  medium: {
    label: "Medium",
    className: "bg-yellow-100 text-yellow-700 border-yellow-200",
  },
  low: { label: "Low", className: "bg-blue-100 text-blue-700 border-blue-200" },
  lowest: {
    label: "Lowest",
    className: "bg-slate-100 text-slate-500 border-slate-200",
  },
};

export default function PriorityTag({ priority, className }) {
  const config = priorityConfig[priority];
  if (!config) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  );
}

export { priorityConfig };
