import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "./LoginForm";

test("requires an email and password before submitting", async () => {
  const submit = vi.fn();
  render(<LoginForm onSubmit={submit} />);
  await userEvent.click(screen.getByRole("button", { name: /sign in to/i }));
  expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email");
  expect(submit).not.toHaveBeenCalled();
});

test("normalizes email and sends the entered credentials", async () => {
  const submit = vi.fn().mockResolvedValue(undefined);
  render(<LoginForm onSubmit={submit} />);
  await userEvent.type(
    screen.getByLabelText("Email address"),
    "ALICE@example.test",
  );
  await userEvent.type(screen.getByLabelText("Password"), "DemoPass123!");
  await userEvent.click(screen.getByRole("button", { name: /sign in to/i }));
  await waitFor(() =>
    expect(submit).toHaveBeenCalledWith("alice@example.test", "DemoPass123!"),
  );
});

test("shows server errors without discarding form input", async () => {
  render(
    <LoginForm
      onSubmit={vi
        .fn()
        .mockRejectedValue(new Error("Email or password is incorrect."))}
    />,
  );
  await userEvent.type(
    screen.getByLabelText("Email address"),
    "alice@example.test",
  );
  await userEvent.type(screen.getByLabelText("Password"), "WrongPass123!");
  await userEvent.click(screen.getByRole("button", { name: /sign in to/i }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Email or password is incorrect.",
  );
  expect(screen.getByLabelText("Email address")).toHaveValue(
    "alice@example.test",
  );
});

test("disables repeat submissions while login is pending", async () => {
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  render(<LoginForm onSubmit={() => pending} />);
  await userEvent.type(
    screen.getByLabelText("Email address"),
    "alice@example.test",
  );
  await userEvent.type(screen.getByLabelText("Password"), "DemoPass123!");
  await userEvent.click(screen.getByRole("button", { name: /sign in to/i }));
  expect(screen.getByRole("button", { name: /signing in/i })).toBeDisabled();
  await act(async () => {
    finish();
  });
  expect(screen.getByRole("button", { name: /sign in to/i })).toBeEnabled();
});
