import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import Input from "../Input.jsx";

describe("Input password visibility toggle", () => {
  test("password fields start masked with a toggle button", () => {
    render(<Input label="Password" id="pw" type="password" value="secret" onChange={() => {}} />);
    const field = screen.getByLabelText("Password");
    expect(field).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: /show password/i })).toBeInTheDocument();
  });

  test("clicking the toggle reveals the password, and toggles back", async () => {
    const user = userEvent.setup();
    render(<Input label="Password" id="pw" type="password" value="secret" onChange={() => {}} />);
    const field = screen.getByLabelText("Password");

    await user.click(screen.getByRole("button", { name: /show password/i }));
    expect(field).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button", { name: /hide password/i }));
    expect(field).toHaveAttribute("type", "password");
  });

  test("non-password inputs render no toggle button at all", () => {
    render(<Input label="Email" id="email" type="email" value="" onChange={() => {}} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  test("error and helper text render when supplied", () => {
    render(<Input label="Email" id="email" value="" onChange={() => {}} error="Invalid email" helper="We'll never share it" />);
    expect(screen.getByText("Invalid email")).toBeInTheDocument();
    expect(screen.getByText("We'll never share it")).toBeInTheDocument();
  });
});
