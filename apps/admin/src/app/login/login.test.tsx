import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

const signInEmail = vi.hoisted(() => vi.fn());
const verifyTotp = vi.hoisted(() => vi.fn());
const replace = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: { email: signInEmail },
    twoFactor: { verifyTotp },
  },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  // Return no returnTo param by default; individual tests can override by
  // rendering with a different mock if needed.
  useSearchParams: () => ({ get: () => null }),
}));

import LoginPage from "./page";

afterEach(() => {
  cleanup();
  signInEmail.mockReset();
  verifyTotp.mockReset();
  replace.mockReset();
});

describe("LoginPage", () => {
  it("happy path: valid credentials → step transition → focus on TOTP input", async () => {
    signInEmail.mockResolvedValueOnce({
      data: { twoFactorRedirect: true },
      error: null,
    });
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText("Email"), "admin@example.com");
    await user.type(screen.getByLabelText("Password"), "passphrase-12-chars");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() =>
      expect(signInEmail).toHaveBeenCalledWith({
        email: "admin@example.com",
        password: "passphrase-12-chars",
      }),
    );

    const codeInput = await screen.findByLabelText("Authentication code");
    await waitFor(() => expect(codeInput).toHaveFocus());
    expect(replace).not.toHaveBeenCalled();
  });

  it("error path: invalid credentials surface in role=alert region", async () => {
    signInEmail.mockResolvedValueOnce({
      data: null,
      error: { message: "Invalid email or password" },
    });
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText("Email"), "admin@example.com");
    await user.type(screen.getByLabelText("Password"), "passphrase-12-chars");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Invalid email or password",
      ),
    );
    // No step transition on failure.
    expect(
      screen.queryByLabelText("Authentication code"),
    ).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("non-2FA happy path replaces the route to /", async () => {
    signInEmail.mockResolvedValueOnce({ data: {}, error: null });
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText("Email"), "admin@example.com");
    await user.type(screen.getByLabelText("Password"), "passphrase-12-chars");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });

  it("verifies TOTP code on the second step", async () => {
    signInEmail.mockResolvedValueOnce({
      data: { twoFactorRedirect: true },
      error: null,
    });
    verifyTotp.mockResolvedValueOnce({ error: null });
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText("Email"), "admin@example.com");
    await user.type(screen.getByLabelText("Password"), "passphrase-12-chars");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    const codeInput = await screen.findByLabelText("Authentication code");
    await user.type(codeInput, "123456");
    await user.click(screen.getByRole("button", { name: "Verify" }));

    await waitFor(() =>
      expect(verifyTotp).toHaveBeenCalledWith({ code: "123456" }),
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });

  it("keyboard tab order: email → password → submit", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    const email = screen.getByLabelText("Email");
    const password = screen.getByLabelText("Password");
    const submit = screen.getByRole("button", { name: "Continue" });

    // Email is autoFocused by the credentials step.
    await waitFor(() => expect(email).toHaveFocus());
    await user.tab();
    expect(password).toHaveFocus();
    await user.tab();
    expect(submit).toHaveFocus();
  });

  it("is axe-clean on the credentials step", async () => {
    const { container } = render(<LoginPage />);
    expect(await axe(container)).toHaveNoViolations();
  });

  // Defense-in-depth: a missing `method` attribute defaults to GET, which
  // would put the password in the URL (history, referer, server logs) on
  // pre-hydration submission. Lock both auth-form steps to method="post".
  it("auth forms set method=post (no password-in-URL leak)", async () => {
    const { container } = render(<LoginPage />);
    const credentialsForm = container.querySelector("form");
    expect(credentialsForm).not.toBeNull();
    expect(credentialsForm?.getAttribute("method")?.toLowerCase()).toBe("post");

    signInEmail.mockResolvedValueOnce({
      data: { twoFactorRedirect: true },
      error: null,
    });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Email"), "admin@example.com");
    await user.type(screen.getByLabelText("Password"), "passphrase-12-chars");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByLabelText("Authentication code");

    const totpForm = container.querySelector("form");
    expect(totpForm?.getAttribute("method")?.toLowerCase()).toBe("post");
  });

  it("is axe-clean on the TOTP step", async () => {
    signInEmail.mockResolvedValueOnce({
      data: { twoFactorRedirect: true },
      error: null,
    });
    const user = userEvent.setup();
    const { container } = render(<LoginPage />);

    await user.type(screen.getByLabelText("Email"), "admin@example.com");
    await user.type(screen.getByLabelText("Password"), "passphrase-12-chars");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByLabelText("Authentication code");

    expect(await axe(container)).toHaveNoViolations();
  });
});
