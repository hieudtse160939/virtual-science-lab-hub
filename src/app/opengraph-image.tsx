import { ImageResponse } from "next/og";

export const alt = "Virtual Science Lab – K-12 simulations";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: 80,
        background: "linear-gradient(150deg, #e8efff 0%, #f2fbf8 100%)",
        color: "#0f172a",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: 24,
            background: "#1d4ed8",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: 56,
          }}
        >
          ⚗
        </div>
        <div style={{ display: "flex", fontSize: 72, fontWeight: 800 }}>
          Virtual <span style={{ color: "#1d4ed8", marginLeft: 16 }}>Science Lab</span>
        </div>
      </div>
      <div style={{ marginTop: 36, fontSize: 36, color: "#334155" }}>
        Simulations & virtual labs for K-12 science and STEM
      </div>
      <div style={{ marginTop: 16, fontSize: 28, color: "#526077" }}>
        Physics · Chemistry · Biology · Math · Earth Science · STEM
      </div>
    </div>,
    size,
  );
}
