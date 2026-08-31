import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider } from "./AuthProvider";
import { hashDemoCredentials, SecurityWall } from "./SecurityWall";

function renderAuthPreview(preview: "login" | "mfa") {
  window.history.replaceState({}, "", `/?auth-preview=${preview}`);
  return render(
    <AuthProvider>
      <SecurityWall><div>Beveiligde inhoud</div></SecurityWall>
    </AuthProvider>,
  );
}

afterEach(() => {
  window.history.replaceState({}, "", "/");
  window.sessionStorage.clear();
  vi.unstubAllEnvs();
});

describe("auth flow previews", () => {
  it("toont Google en e-mail login met een wachtwoordschakelaar", async () => {
    const user = userEvent.setup();
    renderAuthPreview("login");

    expect(screen.getByRole("heading", { name: "Welkom terug" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Doorgaan met Google" })).toBeInTheDocument();

    const email = screen.getByLabelText("Zakelijk e-mailadres");
    const password = screen.getByLabelText("Wachtwoord");
    await user.type(email, "owner@aurawash.nl");
    await user.type(password, "veilig-wachtwoord");
    expect(password).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "Toon wachtwoord" }));
    expect(password).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button", { name: "Doorgaan met Google" }));
    expect(screen.getByRole("status")).toHaveTextContent("Google OAuth is klaar");
  });

  it("vereist alle zes cijfers voordat 2FA kan worden bevestigd", async () => {
    const user = userEvent.setup();
    renderAuthPreview("mfa");

    expect(screen.getByRole("heading", { name: "Bevestig dat jij het bent" })).toBeInTheDocument();
    const confirm = screen.getByRole("button", { name: "Code bevestigen" });
    expect(confirm).toBeDisabled();

    await user.type(screen.getByLabelText("Zescijferige beveiligingscode"), "123456");

    expect(confirm).toBeEnabled();
    await user.click(confirm);
    expect(screen.getByRole("status")).toHaveTextContent("geldige 2FA opent");
  });

  it("opent de lokale demo alleen met de geconfigureerde accountgegevens", async () => {
    const user = userEvent.setup();
    const password = "test-password";
    vi.stubEnv("VITE_DEMO_LOGIN_DIGEST", await hashDemoCredentials("info@ecomvault.nl", password));
    renderAuthPreview("login");

    await user.type(screen.getByLabelText("Wachtwoord"), "verkeerd");
    await user.click(screen.getByRole("button", { name: "Veilig inloggen" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("E-mailadres of wachtwoord klopt niet");

    await user.clear(screen.getByLabelText("Wachtwoord"));
    await user.type(screen.getByLabelText("Wachtwoord"), password);
    await user.click(screen.getByRole("button", { name: "Veilig inloggen" }));
    expect(await screen.findByText("Beveiligde inhoud")).toBeInTheDocument();
  });
});
