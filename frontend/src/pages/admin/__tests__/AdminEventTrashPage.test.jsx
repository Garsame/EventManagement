import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import AdminEventTrashPage from "../AdminEventTrashPage.jsx";

// The page talks to the API through the admin realm client, and the console
// shell would need a signed-in admin to render anything. Neither matters for
// what this page is responsible for: what it shows, and which call each button
// makes. vi.hoisted because the vi.mock factories below are moved above these
// declarations when the file runs.
const { get, patch, del } = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), del: vi.fn() }));

vi.mock("../../../context/AdminAuthContext.jsx", () => ({
  adminClient: { get, patch, delete: del },
  useAdminAuth: () => ({ user: { role: "admin" }, logout: vi.fn() }),
}));

vi.mock("../../../components/layout/AdminConsoleLayout.jsx", () => ({
  default: ({ title, subtitle, children }) => (
    <div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {children}
    </div>
  ),
}));

const trashRow = (overrides = {}) => ({
  _id: "665f000000000000000000a1",
  title: "Community Night Market",
  location: "Fifth Avenue Plaza",
  startDateTime: "2026-12-20T16:00:00.000Z",
  deletedAt: "2026-11-08T10:00:00.000Z",
  autoDeleteAt: "2026-12-08T10:00:00.000Z",
  daysLeft: 29,
  mediaCount: 4,
  registrationCount: 2,
  isPremium: false,
  ...overrides,
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <AdminEventTrashPage />
    </MemoryRouter>
  );

beforeEach(() => {
  get.mockReset().mockResolvedValue({ data: { retentionDays: 30, autoPurged: 0, events: [trashRow()] } });
  patch.mockReset().mockResolvedValue({ data: { success: true, event: trashRow() } });
  del.mockReset().mockResolvedValue({ data: { success: true, deleted: { media: 4, registrations: 2 } } });
});

describe("AdminEventTrashPage", () => {
  test("lists a trashed event with what is still attached to it", async () => {
    renderPage();

    expect(await screen.findByText("Community Night Market")).toBeInTheDocument();
    expect(screen.getByText(/4 media file\(s\), 2 registration\(s\)/)).toBeInTheDocument();
    expect(screen.getByText("29 day(s) left")).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith("/api/admin/events/trash");
  });

  test("says the trash is empty rather than showing a blank page", async () => {
    get.mockResolvedValue({ data: { retentionDays: 30, autoPurged: 0, events: [] } });
    renderPage();

    expect(await screen.findByText("Trash is empty.")).toBeInTheDocument();
  });

  test("restores without a confirmation step", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Restore" }));

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith(`/api/admin/events/${trashRow()._id}/restore`)
    );
  });

  test("only deletes for good after a confirmation", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Delete permanently" }));
    expect(del).not.toHaveBeenCalled();

    // The row keeps its own button, so the confirm has to be found inside the
    // dialog rather than by name alone.
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Nobody can undo this/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Delete permanently" }));

    await waitFor(() => expect(del).toHaveBeenCalledWith(`/api/admin/events/${trashRow()._id}/permanent`));
  });

  test("reports events the visit swept out on retention", async () => {
    get.mockResolvedValue({
      data: { retentionDays: 30, autoPurged: 2, events: [trashRow()] },
    });
    renderPage();

    expect(await screen.findByText(/2 event\(s\) passed 30 days/)).toBeInTheDocument();
  });
});
