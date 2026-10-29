import { useEffect, useState, type FormEvent } from "react";
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useAuth } from "./auth";
import { errorMessage } from "./api";
import { LoginForm } from "./components/LoginForm";
import { TicketForm } from "./components/TicketForm";
import { TicketFilters } from "./components/TicketFilters";
import { PriorityBadge, StatusBadge } from "./components/StatusBadge";
import type {
  Ticket,
  Comment,
  Page,
  Filters,
  Status,
  NewTicket,
} from "./types";

const date = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
const time = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark" aria-hidden="true">
        s<span>·</span>
      </span>
      support desk<span className="brand-period">.</span>
    </span>
  );
}
function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" className="error">
      {children}
    </div>
  );
}

function Layout() {
  const { session, logout } = useAuth();
  if (!session) return <Navigate to="/login" replace />;
  return (
    <div className="workspace">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link className="brand-link" to="/tickets">
          <Brand />
        </Link>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav aria-label="Main navigation">
          <NavLink to="/tickets" end>
            <span aria-hidden="true">▤</span> Tickets{" "}
            <span className="nav-arrow" aria-hidden="true">
              ↗
            </span>
          </NavLink>
          <NavLink to="/tickets/new">
            <span aria-hidden="true">＋</span> New ticket
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          <div className="demo-label">
            <span aria-hidden="true">◈</span> Synthetic demo data
          </div>
          <div className="identity">
            <span className="avatar">{session.user.name[0]}</span>
            <div>
              <strong>{session.user.name}</strong>
              <small>{session.user.role}</small>
            </div>
          </div>
          <button className="logout" onClick={logout}>
            Sign out <span aria-hidden="true">↗</span>
          </button>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <span>
            Workspace <span className="slash">/</span> Support tickets
          </span>
          <span className="role-label">
            {session.user.role === "agent"
              ? "Agent workspace"
              : "Customer workspace"}
          </span>
        </header>
        <main id="main">
          <Outlet />
        </main>
        <footer className="site-footer">
          Built for clear conversations.{" "}
          <span>MERN support tickets · synthetic data</span>
        </footer>
      </div>
    </div>
  );
}

function LoginPage() {
  const { session, login, message } = useAuth();
  const navigate = useNavigate();
  if (session) return <Navigate to="/tickets" replace />;
  return (
    <div className="login-page">
      <section className="login-story">
        <Brand />
        <div>
          <span className="eyebrow">A LITTLE LESS BACK AND FORTH</span>
          <h1>
            Good support <br />
            starts with a <br />
            <em>conversation.</em>
          </h1>
          <p>One place for requests, updates, and the people who can help.</p>
          <div className="story-cards" aria-hidden="true">
            <div>
              <span className="mini-icon">↗</span>
              <strong>A request comes in.</strong>
              <span>Every detail, in one place.</span>
            </div>
            <div>
              <span className="mini-icon">✓</span>
              <strong>A clear next step.</strong>
              <span>Open. In progress. Done.</span>
            </div>
          </div>
        </div>
        <small>Support desk / a small MERN project</small>
      </section>
      <section className="login-panel">
        <div className="login-content">
          <span className="eyebrow">WELCOME BACK</span>
          <h2>
            Your workspace <br />
            is right here.
          </h2>
          <p className="muted">Sign in to pick up the conversation.</p>
          {message && <Notice>{message}</Notice>}
          <LoginForm
            onSubmit={async (email, password) => {
              await login(email, password);
              navigate("/tickets");
            }}
          />
          <details className="demo-accounts">
            <summary>Try the synthetic demo accounts</summary>
            <p>
              <strong>Customer:</strong> alice@example.test
              <br />
              <strong>Another customer:</strong> bruno@example.test
              <br />
              <strong>Agent:</strong> agent@example.test
              <br />
              <strong>Password for all:</strong> <code>DemoPass123!</code>
            </p>
            <p>Available when the demo or seed has run.</p>
          </details>
          <div className="login-footnote">
            Synthetic accounts. No real customer data.
          </div>
        </div>
      </section>
    </div>
  );
}

function TicketList() {
  const { request, session } = useAuth();
  const [params, setParams] = useSearchParams();
  const [result, setResult] = useState<Page<Ticket> | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const query = params.toString();
  const filters = {
    q: params.get("q") ?? "",
    status: params.get("status") ?? "",
    priority: params.get("priority") ?? "",
  };
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    setResult(null);
    request<Page<Ticket>>(`/tickets?${query}`, { signal: controller.signal })
      .then((value) => {
        if (!controller.signal.aborted) setResult(value);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(errorMessage(error));
      });
    return () => controller.abort();
  }, [request, query, retry]);
  function apply(filters: Filters) {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(filters))
      if (value) next.set(key, value);
    setParams(next);
  }
  function page(value: number) {
    const next = new URLSearchParams(params);
    next.set("page", String(value));
    setParams(next);
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">KEEP THINGS MOVING</span>
          <h1>
            {session?.user.role === "agent" ? "Support queue" : "Your tickets"}
            <span className="heading-dot">.</span>
          </h1>
          <p className="muted">
            {session?.user.role === "agent"
              ? "A shared view of every request and its next step."
              : "A clear view of your requests, from first question to final answer."}
          </p>
        </div>
        <Link className="primary" to="/tickets/new">
          <span aria-hidden="true">＋</span> New ticket
        </Link>
      </div>
      <section className="ticket-panel" aria-label="Ticket list">
        <div className="panel-heading">
          <h2>
            All requests <span className="count">{result?.total ?? "—"}</span>
          </h2>
          <span className="muted small">Newest first</span>
        </div>
        <TicketFilters filters={filters} onApply={apply} />
        {error ? (
          <div className="panel-message">
            <Notice>{error}</Notice>
            <button className="secondary" onClick={() => setRetry(retry + 1)}>
              Try again
            </button>
          </div>
        ) : !result ? (
          <p role="status" className="panel-message">
            Loading your tickets…
          </p>
        ) : !result.items.length ? (
          <div className="empty-state">
            <span aria-hidden="true">▤</span>
            <h3>
              {result.total > 0
                ? "No tickets on this page"
                : "No tickets found"}
            </h3>
            <p>Try another filter or create a new request.</p>
            {params.has("page") ? (
              <button className="secondary" onClick={() => page(1)}>
                Back to first page
              </button>
            ) : (
              <Link className="secondary" to="/tickets/new">
                Create a ticket
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="table-scroll">
              <table className="ticket-table">
                <thead>
                  <tr>
                    <th>REQUEST</th>
                    <th>STATUS</th>
                    <th>PRIORITY</th>
                    <th>CREATED</th>
                    <th>
                      <span className="sr-only">Open ticket</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((ticket) => (
                    <tr key={ticket.id}>
                      <td>
                        <Link
                          className="ticket-title"
                          to={`/tickets/${ticket.id}`}
                        >
                          {ticket.title}
                        </Link>
                        <div className="ticket-subline">
                          <span>#{ticket.id.slice(-6).toUpperCase()}</span>
                          <span aria-hidden="true">·</span>
                          {ticket.owner?.name ?? "Former user"}
                        </div>
                      </td>
                      <td>
                        <StatusBadge status={ticket.status} />
                      </td>
                      <td>
                        <PriorityBadge priority={ticket.priority} />
                      </td>
                      <td className="date-cell">{date(ticket.createdAt)}</td>
                      <td>
                        <Link
                          className="row-link"
                          to={`/tickets/${ticket.id}`}
                          aria-label={`Open ${ticket.title}`}
                        >
                          ↗
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <span>
                Showing {(result.page - 1) * result.limit + 1}–
                {Math.min(result.page * result.limit, result.total)} of{" "}
                {result.total} requests
              </span>
              <div>
                <button
                  className="secondary"
                  disabled={result.page <= 1}
                  onClick={() => page(result.page - 1)}
                >
                  ← Previous
                </button>
                <span className="page-number">
                  {result.page} / {result.totalPages}
                </span>
                <button
                  className="secondary"
                  disabled={result.page >= result.totalPages}
                  onClick={() => page(result.page + 1)}
                >
                  Next →
                </button>
              </div>
            </div>
          </>
        )}
      </section>
      <div className="below-panel">
        <span aria-hidden="true">◌</span>{" "}
        {session?.user.role === "agent"
          ? "You can view every ticket, join the conversation, and update its status."
          : "Only you and support agents can see your tickets and comments."}
      </div>
    </>
  );
}

function NewTicketPage() {
  const { request } = useAuth();
  const navigate = useNavigate();
  async function create(input: NewTicket) {
    const result = await request<{ ticket: Ticket }>("/tickets", {
      method: "POST",
      body: JSON.stringify(input),
    });
    navigate(`/tickets/${result.ticket.id}`);
  }
  return (
    <>
      <Link className="back-link" to="/tickets">
        ← All tickets
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">LET’S GET IT SORTED</span>
          <h1>
            Start a conversation<span className="heading-dot">.</span>
          </h1>
          <p className="muted">
            Tell us a little about what you need help with.
          </p>
        </div>
      </div>
      <section className="form-panel">
        <TicketForm onSubmit={create} />
      </section>
    </>
  );
}

function TicketDetail() {
  const { id } = useParams();
  const { request, session } = useAuth();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<Page<Comment> | null>(null);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<Status>("open");
  const [busy, setBusy] = useState(false);
  const [moreBusy, setMoreBusy] = useState(false);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    setTicket(null);
    setComments(null);
    setBody("");
    Promise.all([
      request<{ ticket: Ticket }>(`/tickets/${id}`, {
        signal: controller.signal,
      }),
      request<Page<Comment>>(`/tickets/${id}/comments`, {
        signal: controller.signal,
      }),
    ])
      .then(([result, comments]) => {
        if (!controller.signal.aborted) {
          setTicket(result.ticket);
          setStatus(result.ticket.status);
          setComments(comments);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(errorMessage(error));
      });
    return () => controller.abort();
  }, [id, request, version]);
  async function comment(event: FormEvent) {
    event.preventDefault();
    if (!body.trim() || body.trim().length > 2000) {
      setActionError("Write a comment of 1–2,000 characters.");
      return;
    }
    setBusy(true);
    setActionError("");
    try {
      await request(`/tickets/${id}/comments`, {
        method: "POST",
        body: JSON.stringify({ body: body.trim() }),
      });
      setBody("");
      setVersion((v) => v + 1);
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  async function updateStatus(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setActionError("");
    try {
      const result = await request<{ ticket: Ticket }>(
        `/tickets/${id}/status`,
        { method: "PATCH", body: JSON.stringify({ status }) },
      );
      setTicket(result.ticket);
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  async function more() {
    if (!comments) return;
    setMoreBusy(true);
    setActionError("");
    try {
      const next = await request<Page<Comment>>(
        `/tickets/${id}/comments?page=${comments.page + 1}`,
      );
      setComments({
        ...next,
        items: [
          ...comments.items,
          ...next.items.filter(
            (n) => !comments.items.some((c) => c.id === n.id),
          ),
        ],
      });
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setMoreBusy(false);
    }
  }
  if (error)
    return (
      <>
        <Link className="back-link" to="/tickets">
          ← All tickets
        </Link>
        <Notice>{error}</Notice>
        <button className="secondary" onClick={() => setVersion((v) => v + 1)}>
          Try again
        </button>
      </>
    );
  if (!ticket) return <p role="status">Loading ticket…</p>;
  return (
    <>
      <Link className="back-link" to="/tickets">
        ← All tickets
      </Link>
      <div className="detail-heading">
        <span className="eyebrow">
          REQUEST #{ticket.id.slice(-6).toUpperCase()}
        </span>
        <h1>{ticket.title}</h1>
        <p className="muted">
          Opened by {ticket.owner?.name ?? "Former user"} on{" "}
          {date(ticket.createdAt)}
        </p>
      </div>
      <div className="detail-grid">
        <div>
          <section className="detail-card">
            <h2>The request</h2>
            <p className="preserve-space">{ticket.description}</p>
          </section>
          <section className="detail-card conversation">
            <div className="panel-heading">
              <h2>
                Conversation{" "}
                <span className="count">{comments?.total ?? 0}</span>
              </h2>
              <span className="small muted">Newest replies first</span>
            </div>
            <form onSubmit={comment} className="comment-form">
              <label htmlFor="comment">Add to the conversation</label>
              <textarea
                id="comment"
                required
                maxLength={2000}
                rows={3}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write an update or ask a question…"
              />
              <div className="comment-footer">
                <span className="muted small">
                  Visible to the customer and support agents.
                </span>
                <button
                  className="primary"
                  disabled={busy || moreBusy || !body.trim()}
                >
                  {busy ? "Saving…" : "Post comment"}
                </button>
              </div>
            </form>
            {!comments?.items.length && (
              <p className="muted no-comments">
                No replies yet. You can start the conversation.
              </p>
            )}
            {comments?.items.map((comment) => (
              <article className="comment" key={comment.id}>
                <span className="avatar">{comment.author?.name[0] ?? "?"}</span>
                <div>
                  <div className="comment-meta">
                    <strong>{comment.author?.name ?? "Former user"}</strong>
                    <span className="role-tag">{comment.author?.role}</span>
                    <time dateTime={comment.createdAt}>
                      {time(comment.createdAt)}
                    </time>
                  </div>
                  <p className="preserve-space">{comment.body}</p>
                </div>
              </article>
            ))}
            {comments && comments.page < comments.totalPages && (
              <button
                className="secondary"
                disabled={moreBusy || busy}
                onClick={more}
              >
                {moreBusy ? "Loading…" : "Load older comments"}
              </button>
            )}
          </section>
        </div>
        <aside className="detail-card ticket-meta">
          <span className="eyebrow">TICKET DETAILS</span>
          <dl>
            <dt>Status</dt>
            <dd>
              <StatusBadge status={ticket.status} />
            </dd>
            <dt>Priority</dt>
            <dd>
              <PriorityBadge priority={ticket.priority} />
            </dd>
            <dt>Requested by</dt>
            <dd>{ticket.owner?.name ?? "Former user"}</dd>
            <dt>Last updated</dt>
            <dd>{date(ticket.updatedAt)}</dd>
          </dl>
          {session?.user.role === "agent" && (
            <form className="status-form" onSubmit={updateStatus}>
              <label htmlFor="status">Update status</label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as Status)}
              >
                <option value="open">Open</option>
                <option value="in progress">In progress</option>
                <option value="done">Done</option>
              </select>
              <button
                className="secondary full"
                disabled={busy || status === ticket.status}
              >
                Save status
              </button>
            </form>
          )}
        </aside>
      </div>
      {actionError && <Notice>{actionError}</Notice>}
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<Layout />}>
        <Route path="/tickets" element={<TicketList />} />
        <Route path="/tickets/new" element={<NewTicketPage />} />
        <Route path="/tickets/:id" element={<TicketDetail />} />
        <Route path="/" element={<Navigate to="/tickets" replace />} />
        <Route
          path="*"
          element={
            <div className="empty-state">
              <h1>Page not found</h1>
              <Link to="/tickets">Return to tickets</Link>
            </div>
          }
        />
      </Route>
    </Routes>
  );
}
