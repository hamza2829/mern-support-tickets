# Verification record

Checked locally on **29 October 2026** using Windows, Node **22.19.0** and npm **10.9.3**. Code and checks were prepared/executed by Codex; no statement of the user's personal testing is implied.

| Check                      | Observed result                                                               |
| -------------------------- | ----------------------------------------------------------------------------- |
| `npm run test -w backend`  | **64 passed**, Jest + Supertest + MongoDB 8.2.6 through mongodb-memory-server |
| `npm run test -w frontend` | **10 passed**, Vitest + Testing Library + jsdom, three components             |
| `npm run build`            | Backend TypeScript and frontend TypeScript/Vite builds passed                 |
| Local readiness            | Frontend HTTP 200; API reported database connected                            |
| Ubuntu CI                  | Workflow supplied; exact successful run will be recorded after publication    |

API tests use a real local mongod process. They isolate test collections between cases and disconnect/stop the database afterward. They do not rely on a developer's MongoDB service or Atlas credentials. A cached vendor binary avoids repeated downloads. The explicit test-only OS adapter follows [MongoDB NODE-7832](https://jira.mongodb.org/browse/NODE-7832); the unmodified runtime connection was also checked outside Jest.

## Browser smoke check

On the locally running synthetic demo:

1. Signed in as Alice and observed only her six tickets.
2. Applied `export` + Open + High and observed one matching ticket.
3. Created a High ticket through the form, then posted a customer comment; the detail view showed the saved comment and Alice as author.
4. Signed out, signed in as the agent, and observed all thirteen tickets, including the added smoke-test record.
5. Paginated the queue, opened the new customer ticket, and saved status **In progress**; the badge and selected status reflected the change.
6. Inspected the narrow layout and the desktop breakpoint. Captured [the real agent-queue screenshot](screenshots/agent-queue.jpg); no mockup was substituted.

This is a development smoke check, **not an automated browser E2E suite**. Role/ownership negative cases are covered in the API suite. Only LoginForm, TicketForm and TicketFilters have component tests; whole-page/API integration and production hosting are not asserted by those tests.

## Dependency advisory note

The full `npm audit` on 29 October 2026 reported **6 low-severity findings**, following the Jest / jest-config / `deepmerge` dependency chain ([GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4)). npm suggested a forced downgrade of Jest to version 25; that incompatible downgrade was not applied. These packages are development/test tooling. `npm audit --omit=dev` reported **zero production dependency findings** at that time. This record is a point-in-time advisory check, not an independent security assessment. Keep reviewing advisories when dependencies change.

## Not verified

No deployment, persistent MongoDB/Atlas environment, production traffic/load, independent security review, complete accessibility audit, password lifecycle, or automated browser suite has been tested here. Demo credentials and all sample content are public fictional fixtures.
