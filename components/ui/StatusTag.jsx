import React from "react";
import { cn } from "@/lib/utils";

const statusConfig = {
  backlog: {
    label: "Backlog",
    className:
      "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-600 dark:text-slate-100 dark:border-slate-500",
  },
  in_progress: {
    label: "In Progress",
    className:
      "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700",
  },
  estimation: {
    label: "Estimation",
    className:
      "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/50 dark:text-purple-300 dark:border-purple-700",
  },
  review: {
    label: "Review",
    className:
      "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/50 dark:text-indigo-300 dark:border-indigo-700",
  },
  done_in_staging: {
    label: "Done in Staging",
    className:
      "bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/50 dark:text-teal-300 dark:border-teal-700",
  },
  waiting_for_confirmation: {
    label: "Waiting Confirm.",
    className:
      "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-700",
  },
  paused: {
    label: "Paused",
    className:
      "bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600",
  },
  done: {
    label: "Done",
    className:
      "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700",
  },
};

export default function StatusTag({ status, className }) {
  const config = statusConfig[status];
  if (!config) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap",
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  );
}

export { statusConfig };
