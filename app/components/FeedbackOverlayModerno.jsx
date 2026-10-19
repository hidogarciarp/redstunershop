"use client";
import React, { useEffect, useState } from "react";
import ModalConfirmacaoDialog from "./ModalConfirmacaoDialog";

/**
 * FeedbackOverlayModerno
 * Sistema de notificações Toast Flutuantes e Diálogos Modernos em Dark Glassmorphism.
 * Substitui os popups nativos feios do navegador (alert / confirm / prompt).
 */
export default function FeedbackOverlayModerno({
  toasts = [],
  removerToast,
  modalDialog,
  fecharModalDialog,
}) {
  return (
    <>
      {/* ================= ESTILOS DE ANIMAÇÃO ================= */}
      <style>{`
        @keyframes toastSlideDown {
          0% {
            opacity: 0;
            transform: translateY(-24px) scale(0.96);
          }
          60% {
            opacity: 1;
            transform: translateY(4px) scale(1.01);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes toastProgress {
          from { width: 100%; }
          to { width: 0%; }
        }
        @keyframes toastPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
      `}</style>

      {/* ================= CONTAINER DE TOASTS FLUTUANTES (TOPO) ================= */}
      {toasts && toasts.length > 0 && (
        <div
          style={{
            position: "fixed",
            top: "24px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9999999,
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            alignItems: "center",
            width: "100%",
            maxWidth: "480px",
            padding: "0 16px",
            boxSizing: "border-box",
            pointerEvents: "none",
          }}
        >
          {toasts.map((toast) => {
            const config = getConfigPorTipo(toast.tipo);
            const duracaoMs = toast.duracao || 4000;

            return (
              <div
                key={toast.id}
                style={{
                  pointerEvents: "auto",
                  width: "100%",
                  background: "linear-gradient(135deg, rgba(20, 20, 26, 0.96) 0%, rgba(10, 10, 14, 0.98) 100%)",
                  backdropFilter: "blur(20px)",
                  border: `1px solid ${config.borda}`,
                  borderRadius: "16px",
                  boxShadow: `0 14px 40px -8px rgba(0,0,0,0.8), 0 0 25px ${config.glow}`,
                  padding: "14px 16px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  color: "#ffffff",
                  position: "relative",
                  overflow: "hidden",
                  boxSizing: "border-box",
                  animation: "toastSlideDown 0.32s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                }}
              >
                {/* ÍCONE COM GLOW */}
                <div
                  style={{
                    width: "38px",
                    height: "38px",
                    minWidth: "38px",
                    borderRadius: "12px",
                    background: config.glow,
                    border: `1.5px solid ${config.cor}`,
                    color: config.cor,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "18px",
                    fontWeight: "900",
                    boxShadow: `0 0 16px ${config.glow}`,
                    animation: "toastPulse 2s infinite ease-in-out",
                  }}
                >
                  {config.icone}
                </div>

                {/* TEXTOS (TÍTULO E MENSAGEM) */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {toast.titulo && (
                    <div
                      style={{
                        fontSize: "13.5px",
                        fontWeight: "800",
                        color: "#ffffff",
                        letterSpacing: "-0.2px",
                        marginBottom: "3px",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span>{toast.titulo}</span>
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: "700",
                          textTransform: "uppercase",
                          padding: "1px 6px",
                          borderRadius: "6px",
                          background: config.glow,
                          color: config.cor,
                          border: `1px solid ${config.cor}33`,
                        }}
                      >
                        {config.badge}
                      </span>
                    </div>
                  )}
                  <div
                    style={{
                      fontSize: "12.5px",
                      color: "#d4d4d8",
                      lineHeight: "1.45",
                      wordBreak: "break-word",
                      whiteSpace: "pre-line",
                    }}
                  >
                    {toast.mensagem}
                  </div>
                </div>

                {/* BOTÃO FECHAR DISCRETO */}
                <button
                  type="button"
                  onClick={() => removerToast(toast.id)}
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#a1a1aa",
                    width: "26px",
                    height: "26px",
                    minWidth: "26px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "14px",
                    fontWeight: "700",
                    padding: 0,
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "#ffffff";
                    e.currentTarget.style.background = "rgba(255,255,255,0.15)";
                    e.currentTarget.style.borderColor = config.cor;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "#a1a1aa";
                    e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                  }}
                  title="Fechar notificação"
                >
                  ✕
                </button>

                {/* BARRA DE PROGRESSO ANIMADA (DECRESCENTE) */}
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    height: "3px",
                    background: `linear-gradient(90deg, ${config.cor}, ${config.cor}88)`,
                    boxShadow: `0 0 10px ${config.cor}`,
                    animation: `toastProgress ${duracaoMs}ms linear forwards`,
                  }}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* ================= MODAL DE DIÁLOGO / CONFIRMAÇÃO FLUTUANTE ================= */}
      {modalDialog && (
        <ModalConfirmacaoDialog
          isOpen={true}
          tipo={modalDialog.tipo || "pergunta"}
          titulo={modalDialog.titulo}
          mensagem={modalDialog.mensagem}
          textoConfirmar={modalDialog.textoConfirmar || "Confirmar"}
          textoCancelar={modalDialog.textoCancelar || "Cancelar"}
          valorInputPadrao={modalDialog.valorInputPadrao || ""}
          placeholderInput={modalDialog.placeholderInput || ""}
          onConfirmar={(inputVal) => {
            if (typeof modalDialog.onConfirmar === "function") {
              modalDialog.onConfirmar(inputVal);
            }
            fecharModalDialog();
          }}
          onCancelar={() => {
            if (typeof modalDialog.onCancelar === "function") {
              modalDialog.onCancelar();
            }
            fecharModalDialog();
          }}
        />
      )}
    </>
  );
}

/**
 * Mapeamento de estilos por tipo de notificação
 */
function getConfigPorTipo(tipo = "sucesso") {
  switch (tipo) {
    case "sucesso":
      return {
        icone: "✓",
        badge: "Sucesso",
        cor: "#22c55e",
        borda: "rgba(34, 197, 94, 0.45)",
        glow: "rgba(34, 197, 94, 0.22)",
      };
    case "erro":
    case "perigo":
      return {
        icone: "✕",
        badge: "Atenção",
        cor: "#ef4444",
        borda: "rgba(239, 68, 68, 0.45)",
        glow: "rgba(239, 68, 68, 0.25)",
      };
    case "aviso":
    case "alerta":
      return {
        icone: "!",
        badge: "Aviso",
        cor: "#facc15",
        borda: "rgba(250, 204, 21, 0.45)",
        glow: "rgba(250, 204, 21, 0.22)",
      };
    case "pergunta":
    case "confirmacao":
      return {
        icone: "?",
        badge: "Confirmação",
        cor: "#38bdf8",
        borda: "rgba(56, 189, 248, 0.45)",
        glow: "rgba(56, 189, 248, 0.22)",
      };
    case "info":
    default:
      return {
        icone: "ℹ",
        badge: "Sistema",
        cor: "#e11d48", // Vermelho Red's Tunershop
        borda: "rgba(225, 29, 72, 0.45)",
        glow: "rgba(225, 29, 72, 0.22)",
      };
  }
}
