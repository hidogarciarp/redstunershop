"use client";

import { useState } from "react";
import Image from "next/image";

const techStack = [
  { label: "Next.js", icon: "N", color: "#ffffff" },
  { label: "React", icon: "R", color: "#38bdf8" },
  { label: "Recharts", icon: "C", color: "#facc15" },
  { label: "Tesseract", icon: "T", color: "#f97316" },
  { label: "TypeScript", icon: "TS", color: "#60a5fa" },
  { label: "Red's UI", icon: "RT", color: "#ef4444" },
];

function CodeIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m8 9-4 3 4 3M16 9l4 3-4 3M14 5l-4 14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MessageIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.7 8.7 0 0 1-3.8-.9L3 21l1.8-5A8.3 8.3 0 0 1 4 11.5a8.5 8.5 0 0 1 17 0Z" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export default function DeveloperButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <style>{`
        @keyframes devPulse {
          0%, 100% { box-shadow: 0 12px 30px rgba(0,0,0,0.45), 0 0 0 0 rgba(180,13,13,0.35); }
          50% { box-shadow: 0 14px 36px rgba(0,0,0,0.55), 0 0 0 8px rgba(180,13,13,0); }
        }
        @keyframes devModalIn {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .reds-dev-button:hover { transform: translateY(-2px) scale(1.04); filter: brightness(1.08); }
        .reds-dev-action:hover { transform: translateY(-1px); filter: brightness(1.08); }
        .reds-dev-close:hover { background: rgba(255,255,255,0.1) !important; color: #fff !important; }
      `}</style>

      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="reds-dev-button"
        title="Desenvolvedor do Sistema"
        style={{
          position: "fixed",
          right: "18px",
          bottom: "92px",
          zIndex: 100000,
          display: "flex",
          alignItems: "center",
          gap: "7px",
          border: "1px solid rgba(255,255,255,0.16)",
          borderRadius: "999px",
          padding: "9px 13px",
          background: "linear-gradient(135deg, #3d070b 0%, #8b181e 55%, #150204 100%)",
          color: "#ffffff",
          cursor: "pointer",
          fontFamily: "'Inter', sans-serif",
          fontSize: "12px",
          fontWeight: 900,
          letterSpacing: "0.8px",
          transition: "transform 0.2s ease, filter 0.2s ease",
          animation: "devPulse 3s ease-in-out infinite",
          userSelect: "none",
        }}
      >
        <CodeIcon size={15} />
        NK
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Desenvolvedor do sistema"
          onClick={() => setIsOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100001,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            background: "rgba(0,0,0,0.82)",
            backdropFilter: "blur(10px)",
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "430px",
              borderRadius: "20px",
              overflow: "hidden",
              background: "linear-gradient(180deg, rgba(23,23,23,0.98) 0%, rgba(12,12,12,0.98) 100%)",
              border: "1px solid rgba(255,255,255,0.1)",
              boxShadow: "0 28px 80px rgba(0,0,0,0.65)",
              animation: "devModalIn 0.2s ease-out",
              fontFamily: "'Inter', sans-serif",
              color: "#fff",
            }}
          >
            <div
              style={{
                position: "relative",
                padding: "28px 26px 24px",
                textAlign: "center",
                backgroundImage: "linear-gradient(150deg, rgba(61,7,11,0.96), rgba(139,24,30,0.9) 48%, rgba(10,10,10,0.96)), url('/bg-mechanical.jpg')",
                backgroundSize: "cover",
                backgroundPosition: "center",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="reds-dev-close"
                aria-label="Fechar"
                style={{
                  position: "absolute",
                  top: "12px",
                  right: "12px",
                  width: "32px",
                  height: "32px",
                  display: "grid",
                  placeItems: "center",
                  borderRadius: "8px",
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(0,0,0,0.25)",
                  color: "rgba(255,255,255,0.65)",
                  cursor: "pointer",
                  transition: "all 0.18s ease",
                }}
              >
                <CloseIcon />
              </button>

              <div style={{ display: "flex", justifyContent: "center", marginBottom: "14px" }}>
                <div style={{ width: "86px", height: "86px", borderRadius: "18px", display: "grid", placeItems: "center", background: "rgba(0,0,0,0.34)", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 18px 36px rgba(0,0,0,0.35)" }}>
                  <Image src="/logo_reds.png" alt="Red's Tunershop" width={76} height={66} style={{ width: "76px", maxHeight: "66px", objectFit: "contain" }} />
                </div>
              </div>
              <h2 style={{ margin: 0, fontSize: "21px", lineHeight: 1.2, fontWeight: 900, letterSpacing: "0.8px", textTransform: "uppercase" }}>
                Rugivon Macedo
              </h2>
              <p style={{ margin: "7px 0 0", color: "rgba(255,255,255,0.76)", fontSize: "13px", fontWeight: 700 }}>
                Developer da Red&apos;s Tunershop
              </p>
              <div style={{ marginTop: "16px", display: "inline-flex", alignItems: "center", gap: "8px", padding: "7px 12px", borderRadius: "999px", background: "rgba(0,0,0,0.28)", border: "1px solid rgba(255,255,255,0.1)", color: "#facc15", fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.6px" }}>
                Sistema de registro e gestão
              </div>
            </div>

            <div style={{ padding: "24px 24px 22px" }}>
              <p style={{ margin: "0 auto 22px", maxWidth: "330px", textAlign: "center", color: "#b8b8b8", fontSize: "13px", lineHeight: 1.65, fontStyle: "italic" }}>
                &ldquo;Performance, controle e acabamento: a oficina tambem precisa rodar redondo.&rdquo;
              </p>

              <div style={{ marginBottom: "22px" }}>
                <p style={{ margin: "0 0 12px", textAlign: "center", color: "#7f7f7f", fontSize: "10px", fontWeight: 900, letterSpacing: "1.8px", textTransform: "uppercase" }}>
                  Stack do Projeto
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px" }}>
                  {techStack.map((tech) => (
                    <div key={tech.label} style={{ display: "flex", alignItems: "center", gap: "9px", minHeight: "42px", padding: "9px 10px", borderRadius: "10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                      <span style={{ width: "24px", height: "24px", borderRadius: "7px", display: "grid", placeItems: "center", flexShrink: 0, background: "rgba(0,0,0,0.28)", border: "1px solid rgba(255,255,255,0.08)", color: tech.color, fontSize: tech.icon.length > 1 ? "9px" : "12px", fontWeight: 900 }}>
                        {tech.icon}
                      </span>
                      <span style={{ color: "#e5e5e5", fontSize: "12px", fontWeight: 800 }}>{tech.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  className="reds-dev-action"
                  onClick={() => window.open("https://wa.me/557398570184", "_blank", "noopener,noreferrer")}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    minHeight: "42px",
                    borderRadius: "10px",
                    border: "1px solid rgba(34,197,94,0.35)",
                    background: "linear-gradient(135deg, #16a34a, #22c55e)",
                    color: "#fff",
                    fontWeight: 900,
                    cursor: "pointer",
                    transition: "all 0.18s ease",
                  }}
                >
                  <MessageIcon />
                  WhatsApp
                </button>
                <button
                  type="button"
                  className="reds-dev-action"
                  onClick={() => setIsOpen(false)}
                  style={{
                    flex: 1,
                    minHeight: "42px",
                    borderRadius: "10px",
                    border: "1px solid rgba(255,255,255,0.1)",
                    background: "rgba(255,255,255,0.06)",
                    color: "#f2f2f2",
                    fontWeight: 900,
                    cursor: "pointer",
                    transition: "all 0.18s ease",
                  }}
                >
                  Fechar
                </button>
              </div>

              <div style={{ marginTop: "18px", paddingTop: "16px", borderTop: "1px solid rgba(255,255,255,0.08)", textAlign: "center", color: "#777", fontSize: "10px", fontWeight: 800, letterSpacing: "0.9px", textTransform: "uppercase", lineHeight: 1.5 }}>
                Desenvolvido para a Red&apos;s Tunershop
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
