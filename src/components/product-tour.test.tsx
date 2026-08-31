import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProductTour, ProductTourStep } from "./product-tour";

const steps: ProductTourStep[] = [
  { selector: "#tour-target", title: "Overzicht", description: "Bekijk de kerncijfers." },
  { selector: "#tour-target", title: "Automatisering", description: "Stel herinneringen in." },
];

function TourHarness({ onSkip = vi.fn(), onFinish = vi.fn() }) {
  const [stepIndex, setStepIndex] = useState(0);
  return (
    <>
      <div id="tour-target">Doel</div>
      <ProductTour
        open
        steps={steps}
        stepIndex={stepIndex}
        onStepChange={setStepIndex}
        onSkip={onSkip}
        onFinish={onFinish}
      />
    </>
  );
}

describe("ProductTour", () => {
  it("navigeert vooruit en terug en rondt de laatste stap af", async () => {
    const user = userEvent.setup();
    const onFinish = vi.fn();
    render(<TourHarness onFinish={onFinish} />);

    expect(screen.getByRole("dialog", { name: /stap 1 van 2/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Overzicht" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Volgende" }));
    expect(screen.getByRole("heading", { name: "Automatisering" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Vorige stap" }));
    expect(screen.getByRole("heading", { name: "Overzicht" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Volgende" }));
    await user.click(screen.getByRole("button", { name: "Afronden" }));
    expect(onFinish).toHaveBeenCalledOnce();
  });

  it("kan direct worden overgeslagen", async () => {
    const user = userEvent.setup();
    const onSkip = vi.fn();
    render(<TourHarness onSkip={onSkip} />);

    await user.click(screen.getByRole("button", { name: "Rondleiding overslaan" }));
    expect(onSkip).toHaveBeenCalledOnce();
  });
});
