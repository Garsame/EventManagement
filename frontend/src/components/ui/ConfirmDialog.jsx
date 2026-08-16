import Modal from "./Modal.jsx";
import Button from "./Button.jsx";

/**
 * Styled replacement for window.confirm. The console never uses native
 * browser dialogs - they carry no branding, can't show multi-line context,
 * and look jarring next to the rest of the UI.
 *
 * Usage: keep the thing-to-delete in state (e.g. `deleteTarget`), render
 * <ConfirmDialog open={!!deleteTarget} ... /> and clear the state in
 * onCancel/after a successful onConfirm.
 */
export default function ConfirmDialog({
  open,
  title = "Are you sure?",
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  tone = "danger",
  loading = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <Modal title={title} onClose={onCancel}>
      {message && <p className="text-muted mt-0 mb-6 whitespace-pre-line">{message}</p>}
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button type="button" variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm} disabled={loading}>
          {loading ? "Working…" : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
