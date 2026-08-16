import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

const READER_ID = "qr-reader-region";

/**
 * Camera-based QR scanner for the check-in desk. Calls onScan with the decoded
 * text. Not every machine running this has a working camera, so failures are
 * surfaced rather than thrown - the check-in page always keeps manual entry
 * available as a fallback.
 */
export default function QrScanner({ onScan, onError }) {
  const scannerRef = useRef(null);
  const onScanRef = useRef(onScan);
  const [status, setStatus] = useState("starting");
  const [message, setMessage] = useState("");

  // Keep the latest callback without restarting the camera on every render.
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    let cancelled = false;
    const scanner = new Html5Qrcode(READER_ID, { verbose: false });
    scannerRef.current = scanner;

    const stopAndClear = () => {
      if (scanner.isScanning) {
        return scanner.stop().then(() => scanner.clear()).catch(() => {});
      }
      return Promise.resolve();
    };

    scanner
      .start(
        // Ideal (not exact) hints - browsers fall back gracefully if a camera
        // can't hit them, and a bigger feed decodes more reliably than the
        // default low-res stream.
        { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        {
          fps: 15,
          // A function (not a fixed 240px box) so the scan target scales with
          // however big the preview actually renders, instead of staying a
          // small fixed square inside a much larger video.
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const edge = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.75);
            return { width: edge, height: edge };
          },
        },
        (decodedText) => {
          onScanRef.current?.(decodedText);
        },
        () => {
          // Fires constantly for frames without a QR code; not an error.
        }
      )
      .then(() => {
        if (cancelled) {
          // The component was torn down while the camera was still starting.
          // Stopping here (instead of only in the cleanup below, which runs
          // too early to see isScanning=true yet) is what actually closes
          // the stream - without it a second start() call for the same
          // element leaves two live camera feeds running at once, which is
          // exactly what React 18 Strict Mode's mount->cleanup->mount used
          // to trigger on this page.
          stopAndClear();
          return;
        }
        setStatus("scanning");
      })
      .catch((err) => {
        if (cancelled) return;
        const text =
          err?.name === "NotAllowedError"
            ? "Camera permission was denied. Enter the code manually below."
            : "No camera available. Enter the code manually below.";
        setStatus("error");
        setMessage(text);
        onError?.(text);
      });

    return () => {
      cancelled = true;
      stopAndClear();
    };
  }, [onError]);

  return (
    <div>
      <div
        id={READER_ID}
        style={{
          width: "100%",
          borderRadius: 12,
          overflow: "hidden",
          background: "#0f172a",
          minHeight: status === "error" ? 0 : 320,
        }}
      />
      {status === "starting" && <p className="text-muted">Starting camera…</p>}
      {status === "error" && <p className="helper-text">{message}</p>}
    </div>
  );
}
