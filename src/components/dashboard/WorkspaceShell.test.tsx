import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { WorkspaceShell } from "./WorkspaceShell";

afterEach(cleanup);

describe("WorkspaceShell", () => {
  it("renders title, description and children", () => {
    render(
      <WorkspaceShell title="Finance Overview" description="All spend">
        <p>Table content</p>
      </WorkspaceShell>,
    );
    expect(screen.getByText("Finance Overview")).toBeInTheDocument();
    expect(screen.getByText("All spend")).toBeInTheDocument();
    expect(screen.getByText("Table content")).toBeInTheDocument();
  });

  it("hides the focus control when focusable is false", () => {
    render(
      <WorkspaceShell title="Small panel" focusable={false}>
        <p>x</p>
      </WorkspaceShell>,
    );
    expect(
      screen.queryByLabelText("Open full screen workspace"),
    ).not.toBeInTheDocument();
  });

  it("enters full screen, locks body scroll and exits with Escape", () => {
    render(
      <WorkspaceShell title="Expenses">
        <p>rows</p>
      </WorkspaceShell>,
    );

    fireEvent.click(screen.getByLabelText("Open full screen workspace"));
    expect(screen.getByLabelText("Exit full screen")).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByLabelText("Open full screen workspace")).toBeInTheDocument();
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("exits full screen via the toggle button", () => {
    render(
      <WorkspaceShell title="Donations">
        <p>rows</p>
      </WorkspaceShell>,
    );
    fireEvent.click(screen.getByLabelText("Open full screen workspace"));
    fireEvent.click(screen.getByLabelText("Exit full screen"));
    expect(screen.getByLabelText("Open full screen workspace")).toBeInTheDocument();
    expect(document.body.style.overflow).not.toBe("hidden");
  });
});
