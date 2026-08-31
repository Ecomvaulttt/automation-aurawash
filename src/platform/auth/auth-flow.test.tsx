import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider } from "./AuthProvider";
import { SecurityWall } from "./SecurityWall";

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
});
