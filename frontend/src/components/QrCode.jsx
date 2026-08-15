import { useEffect, useState } from "react";
import QRCode from "qrcode";

/**
 * Renders `value` as a QR image. Staff scan this at the door to check a guest
 * in, so it encodes the qrToken rather than the short registration code.
 */
export default function QrCode({ value, size = 220, alt = "Registration QR code" }) {
  const [dataUrl, setDataUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    if (!value) {
      setDataUrl("");
      return undefined;
    }

    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#0f172a", light: "#ffffff" },
    })
      .then((url) => {
        if (!cancelled) {
          setDataUrl(url);
          setError("");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Could not render QR code");
      });

    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (error) {
    return <p className="error-text">{error}</p>;
  }

  if (!dataUrl) {
    return (
      <div
        className="card-muted"
        style={{ width: size, height: size, display: "grid", placeItems: "center" }}
      >
        <span className="text-muted">Generating…</span>
      </div>
    );
  }

  return (
    <img
      src={dataUrl}
      alt={alt}
      width={size}
      height={size}
      style={{ borderRadius: 12, border: "1px solid #e2e8f0", background: "#fff" }}
    />
  );
}
