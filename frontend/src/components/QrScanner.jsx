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
    const scanner = new Html5Qrcode(READER_ID);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText) => {
          onScanRef.current?.(decodedText);
        },
        () => {
          // Fires constantly for frames without a QR code; not an error.
        }
      )
      .then(() => {
        if (!cancelled) setStatus("scanning");
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
      const active = scannerRef.current;
      if (active?.isScanning) {
        active.stop().then(() => active.clear()).catch(() => {});
      }
    };
  }, [onError]);

  return (
    <div>
      <div
        id={READER_ID}
        style={{
          width: "100%",
          maxWidth: 320,
          borderRadius: 12,
          overflow: "hidden",
          background: "#0f172a",
          minHeight: status === "error" ? 0 : 240,
        }}
      />
      {status === "starting" && <p className="text-muted">Starting camera…</p>}
      {status === "error" && <p className="helper-text">{message}</p>}
    </div>
  );
}
