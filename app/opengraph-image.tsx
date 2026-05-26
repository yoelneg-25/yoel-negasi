import { ImageResponse } from "next/og";

export const alt = "Yoel Negasi — Senior Full Stack Engineer";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: "#080810",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "80px",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* Background glow */}
        <div
          style={{
            position: "absolute",
            top: -100,
            left: -100,
            width: 500,
            height: 500,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(124,58,237,0.25) 0%, transparent 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -100,
            right: -100,
            width: 400,
            height: 400,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 70%)",
          }}
        />

        {/* Monogram badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 56,
            height: 56,
            borderRadius: 14,
            background: "linear-gradient(135deg, #7c3aed, #a78bfa)",
            fontSize: 22,
            fontWeight: 700,
            color: "white",
            marginBottom: 32,
          }}
        >
          YN
        </div>

        {/* Name */}
        <div
          style={{
            fontSize: 60,
            fontWeight: 700,
            color: "white",
            lineHeight: 1.1,
            marginBottom: 16,
            letterSpacing: "-1px",
          }}
        >
          Yoel Negasi
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 28,
            color: "rgba(167, 139, 250, 1)",
            fontWeight: 500,
            marginBottom: 20,
          }}
        >
          Senior Full Stack Engineer
        </div>

        {/* Description */}
        <div
          style={{
            fontSize: 20,
            color: "rgba(255,255,255,0.45)",
            maxWidth: 680,
            lineHeight: 1.5,
          }}
        >
          React · Node.js · Platform Engineering · CI/CD · AI-Enhanced Workflows
        </div>

        {/* Location */}
        <div
          style={{
            position: "absolute",
            bottom: 60,
            left: 80,
            fontSize: 16,
            color: "rgba(255,255,255,0.25)",
          }}
        >
          Oakland, CA
        </div>
      </div>
    ),
    { ...size }
  );
}
