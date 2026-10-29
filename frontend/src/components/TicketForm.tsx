import { useState, type FormEvent } from "react";
import { errorMessage } from "../api";
import type { NewTicket, Priority } from "../types";

export function TicketForm({
  onSubmit,
}: {
  onSubmit: (ticket: NewTicket) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const input = {
      title: title.trim(),
      description: description.trim(),
      priority,
    };
    if (
      input.title.length < 3 ||
      input.title.length > 120 ||
      input.description.length < 10 ||
      input.description.length > 5000
    ) {
      setError(
        "Use a title of 3–120 characters and a description of 10–5,000 characters.",
      );
      return;
    }
    setError("");
    setBusy(true);
    try {
      await onSubmit(input);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="ticket-form"
      onSubmit={submit}
      noValidate
      aria-label="Create ticket"
      aria-busy={busy}
    >
      <label htmlFor="title">
        A short, clear title <span className="required">*</span>
      </label>
      <input
        id="title"
        required
        minLength={3}
        maxLength={120}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="For example, I can’t export my October report"
      />
      <label htmlFor="description">
        Tell us what happened <span className="required">*</span>
      </label>
      <p className="field-help" id="description-help">
        Include what you expected and what you have already tried. Use fictional
        details in this demo.
      </p>
      <textarea
        id="description"
        required
        minLength={10}
        maxLength={5000}
        rows={7}
        value={description}
        aria-describedby="description-help"
        onChange={(e) => setDescription(e.target.value)}
        placeholder="A little context helps us help you…"
      />
      <label htmlFor="priority">Priority</label>
      <select
        id="priority"
        value={priority}
        onChange={(e) => setPriority(e.target.value as Priority)}
      >
        <option value="low">Low — a question or minor issue</option>
        <option value="normal">Normal — something needs attention</option>
        <option value="high">High — work is blocked</option>
      </select>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="form-footer">
        <span className="muted">Your ticket starts with status Open.</span>
        <button className="primary" disabled={busy}>
          {busy ? "Creating…" : "Create ticket"}{" "}
          <span aria-hidden="true">↗</span>
        </button>
      </div>
    </form>
  );
}
