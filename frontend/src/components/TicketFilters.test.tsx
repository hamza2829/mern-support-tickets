import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TicketFilters } from "./TicketFilters";

test("applies search, status and priority together", async () => {
  const apply = vi.fn();
  render(
    <TicketFilters
      filters={{ q: "", status: "", priority: "" }}
      onApply={apply}
    />,
  );
  await userEvent.type(screen.getByRole("searchbox"), "  export  ");
  await userEvent.selectOptions(screen.getByLabelText("Status"), "in progress");
  await userEvent.selectOptions(screen.getByLabelText("Priority"), "high");
  await userEvent.click(screen.getByRole("button", { name: "Apply" }));
  expect(apply).toHaveBeenCalledWith({
    q: "export",
    status: "in progress",
    priority: "high",
  });
});

test("clear resets every filter and immediately notifies the parent", async () => {
  const apply = vi.fn();
  render(
    <TicketFilters
      filters={{ q: "invoice", status: "open", priority: "low" }}
      onApply={apply}
    />,
  );
  await userEvent.click(screen.getByRole("button", { name: "Clear" }));
  expect(screen.getByRole("searchbox")).toHaveValue("");
  expect(screen.getByLabelText("Status")).toHaveValue("");
  expect(apply).toHaveBeenCalledWith({ q: "", status: "", priority: "" });
});

test("updates controls when the route supplies new filters", () => {
  const apply = vi.fn();
  const { rerender } = render(
    <TicketFilters
      filters={{ q: "", status: "", priority: "" }}
      onApply={apply}
    />,
  );
  rerender(
    <TicketFilters
      filters={{ q: "refund", status: "done", priority: "normal" }}
      onApply={apply}
    />,
  );
  expect(screen.getByRole("searchbox")).toHaveValue("refund");
  expect(screen.getByLabelText("Status")).toHaveValue("done");
  expect(screen.getByLabelText("Priority")).toHaveValue("normal");
});
