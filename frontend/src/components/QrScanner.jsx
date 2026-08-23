import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

const READER_ID = "qr-reader-region";

/**
 * Camera-based QR scanner for the check-in desk. Calls onScan with the decoded
 * text. Not every machine running this has a working camera, so failures are
 * surfaced rather than thrown - the check-in page always keeps manual entry
 * available as a fallback.
 *
 * Two things about html5-qrcode drive the shape of this component:
 *
 * 1. It sizes the <video> once, from `parentElement.clientWidth`, as a fixed
 *    pixel width with no height. Inside a shrink-to-fit flex parent that
 *    measured almost nothing, so the preview came out a sliver. The width is
 *    also never revisited, so rotating a phone left it wrong. `.qr-scanner
 *    video` in global.css overrides both with a fluid width and natural
 *    height - natural rather than cropped on purpose, because the decoder
 *    maps its scan region using videoWidth/clientWidth, and object-fit would
 *    put that mapping out by the cropped margin.
 *
 * 2. It *appends* the video to the container rather than replacing what is
 *    there, so every start() adds another live feed. React 18 Strict Mode
 *    mounts, unmounts and remounts, and stop() is async, so a second start
 *    could land before the first had torn down - which is how the desk ended
 *    up looking at three stacked cameras. The run-token and the queue below
 *    make starts strictly serial, and the container is emptied immediately
 *    before each one, so exactly one <video> can ever exist.
 */
export default function QrScanner({ onScan, onError }) {
  const onScanRef = useRef(onScan);
  const onErrorRef = useRef(onError);
  // Chains every start/stop so two can never overlap.
  const queueRef = useRef(Promise.resolve());
  const [status, setStatus] = useState("starting");
  const [message, setMessage] = useState("");

  // Keep the latest callbacks without restarting the camera on every render.
  useEffect(() => { onScanRef.current = onScan; }, [onScan]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  useEffect(() => {
    let cancelled = false;
    let scanner = null;

    const run = (work) => {
      queueRef.current = queueRef.current.then(work, work);
      return queueRef.current;
    };

    run(async () => {
      const host = document.getElementById(READER_ID);
      if (!host || cancelled) return;

      // Anything left by a previous run - an orphaned <video>, the shaded
      // overlay - goes before a new camera is attached.
      host.replaceChildren();

      scanner = new Html5Qrcode(READER_ID, { verbose: false });

      try {
        await scanner.start(
          // facingMode only - adding width/height "ideal" hints here made
          // start() reject outright on at least one real camera (reported as
          // "No camera available" even though the same camera worked with
          // just facingMode), so this stays as plain as possible. "environment"
          // picks the rear camera on a phone, which is the one pointed at the
          // guest's screen.
          { facingMode: "environment" },
          {
            fps: 15,
            // A function rather than a fixed box, so the scan target scales
            // with however big the preview actually renders.
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const edge = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.75);
              return { width: edge, height: edge };
            },
          },
          (decodedText) => { onScanRef.current?.(decodedText); },
          () => {
            // Fires constantly for frames without a QR code; not an error.
          }
        );
      } catch (err) {
        if (cancelled) return;
        // The UI message stays generic (a guest desk doesn't need to see a
        // DOMException name), but the real reason is worth having in the
        // console when a camera that used to work suddenly doesn't.
        console.warn("QrScanner: camera start failed:", err?.name, err?.message || err);
        const text =
          err?.name === "NotAllowedError" || err?.name === "SecurityError"
            ? "Camera permission was denied. Enter the code manually below."
            : err?.name === "NotFoundError" || err?.name === "OverconstrainedError"
              ? "No camera found on this device. Enter the code manually below."
              : "The camera could not be started. Enter the code manually below.";
        setStatus("error");
        setMessage(text);
        onErrorRef.current?.(text);
        return;
      }

      if (cancelled) {
        // Torn down while the camera was still starting; stop it here, since
        // the cleanup below already ran and saw nothing to stop.
        try { await scanner.stop(); } catch { /* already stopped */ }
        try { scanner.clear(); } catch { /* nothing to clear */ }
        return;
      }
      setStatus("scanning");
    });

    return () => {
      cancelled = true;
      run(async () => {
        if (!scanner) return;
        try { await scanner.stop(); } catch { /* was never scanning */ }
        try { scanner.clear(); } catch { /* nothing to clear */ }
        document.getElementById(READER_ID)?.replaceChildren();
      });
    };
  }, []);

  return (
    <div className="qr-scanner-wrap">
      <div
        id={READER_ID}
        className={`qr-scanner ${status === "error" ? "is-error" : ""}`}
        aria-label="QR code camera preview"
      />
      {status === "starting" && <p className="helper-text text-center mt-2">Starting camera…</p>}
      {status === "scanning" && (
        <p className="helper-text text-center mt-2">
          Hold the guest's QR code inside the frame.
        </p>
      )}
      {status === "error" && <p className="helper-text text-center mt-2">{message}</p>}
    </div>
  );
}
