import type { Status, Priority } from "../types";
export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`badge status-${status.replace(" ", "-")}`}>
      <span aria-hidden="true">●</span>{" "}
      {status === "in progress"
        ? "In progress"
        : status === "done"
          ? "Done"
          : "Open"}
    </span>
  );
}
export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={`priority priority-${priority}`}>
      <span aria-hidden="true">
        {priority === "high" ? "↑" : priority === "low" ? "↓" : "−"}
      </span>{" "}
      {priority[0].toUpperCase() + priority.slice(1)}
    </span>
  );
}
