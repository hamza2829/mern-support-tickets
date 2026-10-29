import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TicketForm } from "./TicketForm";

test("blocks empty or too-short ticket fields", async () => {
  const submit = vi.fn();
  render(<TicketForm onSubmit={submit} />);
  await userEvent.click(screen.getByRole("button", { name: /create ticket/i }));
  expect(screen.getByRole("alert")).toHaveTextContent("3–120 characters");
  expect(submit).not.toHaveBeenCalled();
});

test("submits trimmed fields and the selected priority", async () => {
  const submit = vi.fn().mockResolvedValue(undefined);
  render(<TicketForm onSubmit={submit} />);
  await userEvent.type(
    screen.getByLabelText(/a short, clear title/i),
    "  Export missing a column  ",
  );
  await userEvent.type(
    screen.getByLabelText(/tell us what happened/i),
    "  My test export does not include a reference column.  ",
  );
  await userEvent.selectOptions(screen.getByLabelText("Priority"), "high");
  await userEvent.click(screen.getByRole("button", { name: /create ticket/i }));
  await waitFor(() =>
    expect(submit).toHaveBeenCalledWith({
      title: "Export missing a column",
      description: "My test export does not include a reference column.",
      priority: "high",
    }),
  );
});

test("keeps a failed ticket draft and explains the failure", async () => {
  render(
    <TicketForm
      onSubmit={vi.fn().mockRejectedValue(new Error("Please try again later."))}
    />,
  );
  await userEvent.type(
    screen.getByLabelText(/a short, clear title/i),
    "Draft title",
  );
  await userEvent.type(
    screen.getByLabelText(/tell us what happened/i),
    "A useful description for this test.",
  );
  await userEvent.click(screen.getByRole("button", { name: /create ticket/i }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Please try again later.",
  );
  expect(screen.getByLabelText(/a short, clear title/i)).toHaveValue(
    "Draft title",
  );
});
