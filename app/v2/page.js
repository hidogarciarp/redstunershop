"use client";

import React, { useEffect } from "react";

export default function V2RedirectPage() {
  useEffect(() => {
    // A Versão 2 agora é a versão principal oficial do sistema (/)
    if (typeof window !== "undefined") {
      window.location.replace("/");
    }
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#0b0b0b",
        display: "grid",
        placeItems: "center",
        color: "#fff",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "32px", marginBottom: "12px" }}>🚀</div>
        <div style={{ fontSize: "16px", fontWeight: "700", color: "#6ee7b7" }}>
          Redirecionando para a Versão Principal...
        </div>
        <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "6px" }}>
          A Versão 2 agora é a base oficial da RED'S.
        </div>
      </div>
    </div>
  );
}
