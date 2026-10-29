import { useEffect, useState, type FormEvent } from "react";
import type { Filters } from "../types";

const empty = { q: "", status: "", priority: "" };
export function TicketFilters({
  filters,
  onApply,
}: {
  filters: Filters;
  onApply: (value: Filters) => void;
}) {
  const [draft, setDraft] = useState(filters);
  useEffect(() => {
    setDraft(filters);
  }, [filters.q, filters.status, filters.priority]);
  function apply(event: FormEvent) {
    event.preventDefault();
    onApply({ ...draft, q: draft.q.trim() });
  }
  return (
    <form className="filterbar" onSubmit={apply} aria-label="Filter tickets">
      <div className="search-field">
        <label className="sr-only" htmlFor="search">
          Search tickets
        </label>
        <span aria-hidden="true">⌕</span>
        <input
          id="search"
          type="search"
          maxLength={100}
          value={draft.q}
          onChange={(e) => setDraft({ ...draft, q: e.target.value })}
          placeholder="Search titles and descriptions…"
        />
      </div>
      <div>
        <label className="sr-only" htmlFor="filter-status">
          Status
        </label>
        <select
          id="filter-status"
          value={draft.status}
          onChange={(e) => setDraft({ ...draft, status: e.target.value })}
        >
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="in progress">In progress</option>
          <option value="done">Done</option>
        </select>
      </div>
      <div>
        <label className="sr-only" htmlFor="filter-priority">
          Priority
        </label>
        <select
          id="filter-priority"
          value={draft.priority}
          onChange={(e) => setDraft({ ...draft, priority: e.target.value })}
        >
          <option value="">All priorities</option>
          <option value="low">Low priority</option>
          <option value="normal">Normal priority</option>
          <option value="high">High priority</option>
        </select>
      </div>
      <button className="secondary">Apply</button>
      {(draft.q || draft.status || draft.priority) && (
        <button
          type="button"
          className="text-button"
          onClick={() => {
            setDraft(empty);
            onApply(empty);
          }}
        >
          Clear
        </button>
      )}
    </form>
  );
}
