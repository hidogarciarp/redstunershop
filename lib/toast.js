"use client";

import { createContext, useContext, useState, useCallback } from "react";

const ToastContext = createContext({});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((message, type = "success", duration = 3000) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div style={{
        position: "fixed", top: "20px", right: "20px", zIndex: 99999,
        display: "flex", flexDirection: "column", gap: "8px",
        maxWidth: "400px"
      }}>
        {toasts.map((t) => (
          <div key={t.id} style={{
            background: t.type === "success" ? "#16a34a" : t.type === "error" ? "#dc2626" : t.type === "warning" ? "#d97706" : "#2563eb",
            color: "#fff", padding: "14px 18px", borderRadius: "10px",
            fontSize: "14px", fontWeight: "500",
            boxShadow: "0 8px 30px rgba(0,0,0,0.3)",
            display: "flex", alignItems: "center", gap: "10px",
            animation: "slideIn 0.3s ease",
            cursor: "pointer"
          }} onClick={() => removeToast(t.id)}>
            {t.type === "success" ? "✅" : t.type === "error" ? "❌" : t.type === "warning" ? "⚠️" : "ℹ️"}
            {t.message}
          </div>
        ))}
      </div>
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
