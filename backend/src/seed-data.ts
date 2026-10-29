import bcrypt from "bcryptjs";
import { User, Ticket, Comment } from "./models";

export const DEMO_PASSWORD = "DemoPass123!"; // public synthetic-demo credentials, not a secret
export const DEMO_USERS = [
  { name: "Alice Morgan", email: "alice@example.test", role: "customer" },
  { name: "Bruno Ellis", email: "bruno@example.test", role: "customer" },
  { name: "Sam Rivera", email: "agent@example.test", role: "agent" },
] as const;

export async function seedData() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const users = [];
  for (const user of DEMO_USERS) {
    // Preserve existing accounts; this seed never deletes data or resets a password.
    users.push(
      await User.findOneAndUpdate(
        { email: user.email },
        { $setOnInsert: { ...user, passwordHash } },
        { upsert: true, returnDocument: "after" },
      ),
    );
  }
  if ((await Ticket.countDocuments()) !== 0) return;
  const samples = [
    [
      "Invoice export is missing a column",
      "The October invoice export does not include the reference column. Could you help me find it?",
      "high",
      "open",
    ],
    [
      "Cannot invite a new teammate",
      "The invitation screen returns an error after I enter a new teammate email address.",
      "normal",
      "in progress",
    ],
    [
      "Update the billing contact",
      "Please update the billing contact shown on our next invoice. This is a synthetic request.",
      "low",
      "done",
    ],
    [
      "Notification emails arrive twice",
      "I received the same update twice this morning. The ticket history only shows one change.",
      "normal",
      "open",
    ],
    [
      "Dashboard loads slowly",
      "The dashboard takes more than ten seconds to open when I use the date filter.",
      "high",
      "in progress",
    ],
    [
      "Where can I download my receipts?",
      "I need a copy of the receipts from last month for a test reconciliation exercise.",
      "low",
      "done",
    ],
    [
      "Search does not find archived items",
      "Searching for a known item only returns current records. Is there a way to include the archive?",
      "normal",
      "open",
    ],
    [
      "Change the workspace name",
      "Could you explain how to rename the workspace without changing its member permissions?",
      "low",
      "open",
    ],
    [
      "Report timezone looks incorrect",
      "The daily report appears to use a different timezone from the one selected in my profile.",
      "normal",
      "in progress",
    ],
    [
      "Payment confirmation not visible",
      "A test payment is marked complete but its confirmation is missing from the activity feed.",
      "high",
      "open",
    ],
    [
      "Thanks for fixing the export",
      "The test export now includes the expected columns. Thank you for the quick follow-up.",
      "low",
      "done",
    ],
    [
      "Help choosing a report filter",
      "I would like to filter a report by a date range and a single team. Which controls should I use?",
      "normal",
      "open",
    ],
  ] as const;
  // Relative dates keep newly submitted tickets above the sample history.
  const seededAt = Date.now();
  for (const [index, sample] of samples.entries()) {
    const ticket = await Ticket.create({
      title: sample[0],
      description: sample[1],
      priority: sample[2],
      status: sample[3],
      owner: users[index % 2]!._id,
      createdAt: new Date(seededAt - (index + 1) * 24 * 60 * 60 * 1000),
    });
    if (index % 3 === 1)
      await Comment.create({
        ticket: ticket._id,
        author: users[2]!._id,
        body: "Thanks for the detail. I am looking into this and will post an update here.",
      });
  }
}
