"use client";
import React, { useState, useEffect } from "react";

/**
 * ModalConfirmacaoDialog
 * Diálogo flutuante moderno para substituir alert(), confirm() e prompt() do navegador.
 * Visual sofisticado em Dark Glassmorphism, harmonia com a Red's Tunershop.
 */
export default function ModalConfirmacaoDialog({
  isOpen,
  tipo = "info", // "sucesso" | "erro" | "aviso" | "pergunta" | "prompt" | "info"
  titulo,
  mensagem,
  textoConfirmar = "Confirmar",
  textoCancelar = "Cancelar",
  onConfirmar,
  onCancelar,
  valorInputPadrao = "",
  placeholderInput = "",
  isDarkMode = true,
  theme,
}) {
  const [valorInput, setValorInput] = useState(valorInputPadrao);

  useEffect(() => {
    if (isOpen) {
      setValorInput(valorInputPadrao);
    }
  }, [isOpen, valorInputPadrao]);

  if (!isOpen) return null;

  const getIconeEConfig = () => {
    switch (tipo) {
      case "sucesso":
        return {
          icone: "✓",
          cor: "#22c55e",
          bgGlow: "rgba(34, 197, 94, 0.2)",
          btnCor: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
        };
      case "erro":
      case "perigo":
        return {
          icone: "✕",
          cor: "#ef4444",
          bgGlow: "rgba(239, 68, 68, 0.25)",
          btnCor: "linear-gradient(135deg, #dc2626 0%, #991b1b 100%)",
        };
      case "aviso":
        return {
          icone: "!",
          cor: "#facc15",
          bgGlow: "rgba(250, 204, 21, 0.2)",
          btnCor: "linear-gradient(135deg, #eab308 0%, #ca8a04 100%)",
        };
      case "pergunta":
      case "confirmacao":
        return {
          icone: "?",
          cor: "#38bdf8",
          bgGlow: "rgba(56, 189, 248, 0.2)",
          btnCor: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
        };
      case "prompt":
        return {
          icone: "✎",
          cor: "#f472b6",
          bgGlow: "rgba(244, 114, 182, 0.2)",
          btnCor: "linear-gradient(135deg, #db2777 0%, #be185d 100%)",
        };
      default:
        return {
          icone: "ℹ",
          cor: "#b40d0d",
          bgGlow: "rgba(180, 13, 13, 0.25)",
          btnCor: "linear-gradient(135deg, #b40d0d 0%, #7f1d1d 100%)",
        };
    }
  };

  const config = getIconeEConfig();
  const ehPerguntaOuPrompt = tipo === "pergunta" || tipo === "confirmacao" || tipo === "prompt" || Boolean(onCancelar);

  const handleConfirmar = () => {
    if (tipo === "prompt") {
      onConfirmar?.(valorInput);
    } else {
      onConfirmar?.();
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(5, 5, 5, 0.82)",
        backdropFilter: "blur(12px)",
        zIndex: 999999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        animation: "modalOverlayFade 0.22s ease-out",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !ehPerguntaOuPrompt) {
          onConfirmar?.();
        }
      }}
    >
      <style>{`
        @keyframes modalOverlayFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modalBoxPop {
          from { opacity: 0; transform: scale(0.92) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>

      <div
        style={{
          width: "100%",
          maxWidth: "460px",
          background: "linear-gradient(180deg, #18181b 0%, #0d0d0f 100%)",
          border: `1px solid ${config.cor}45`,
          borderRadius: "22px",
          boxShadow: `0 24px 60px -10px rgba(0,0,0,0.85), 0 0 35px ${config.bgGlow}`,
          padding: "28px 24px 22px",
          textAlign: "center",
          animation: "modalBoxPop 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
          boxSizing: "border-box",
          position: "relative",
          color: "#fff",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        {/* ÍCONE DECORATIVO TOPO */}
        <div
          style={{
            width: "56px",
            height: "56px",
            margin: "0 auto 16px",
            borderRadius: "50%",
            background: config.bgGlow,
            border: `2px solid ${config.cor}`,
            color: config.cor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "26px",
            fontWeight: "900",
            boxShadow: `0 0 20px ${config.bgGlow}`,
          }}
        >
          {config.icone}
        </div>

        {/* TÍTULO */}
        <h3
          style={{
            margin: "0 0 10px",
            fontSize: "19px",
            fontWeight: "800",
            color: "#ffffff",
            letterSpacing: "-0.3px",
          }}
        >
          {titulo || (tipo === "sucesso" ? "Sucesso!" : tipo === "erro" ? "Erro" : "Atenção")}
        </h3>

        {/* MENSAGEM */}
        <div
          style={{
            fontSize: "13.5px",
            color: "#a1a1aa",
            lineHeight: "1.55",
            marginBottom: tipo === "prompt" ? "18px" : "24px",
            whiteSpace: "pre-line",
          }}
        >
          {mensagem}
        </div>

        {/* CAMPO DE ENTRADA CASO PROMPT */}
        {tipo === "prompt" && (
          <div style={{ marginBottom: "22px", textAlign: "left" }}>
            <textarea
              autoFocus
              rows={3}
              style={{
                width: "100%",
                background: "rgba(0,0,0,0.45)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: "12px",
                padding: "12px 14px",
                color: "#fff",
                fontSize: "13px",
                fontFamily: "inherit",
                outline: "none",
                resize: "vertical",
                boxSizing: "border-box",
              }}
              placeholder={placeholderInput}
              value={valorInput}
              onChange={(e) => setValorInput(e.target.value)}
            />
          </div>
        )}

        {/* BOTÕES DE AÇÃO */}
        <div
          style={{
            display: "flex",
            gap: "10px",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {ehPerguntaOuPrompt && onCancelar && (
            <button
              type="button"
              onClick={onCancelar}
              style={{
                flex: 1,
                padding: "12px 18px",
                background: "rgba(255, 255, 255, 0.07)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                borderRadius: "12px",
                color: "#e4e4e7",
                fontSize: "13px",
                fontWeight: "700",
                cursor: "pointer",
                transition: "all 0.18s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.12)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.07)";
              }}
            >
              {textoCancelar}
            </button>
          )}

          <button
            type="button"
            onClick={handleConfirmar}
            style={{
              flex: 1,
              padding: "12px 20px",
              background: config.btnCor,
              border: "none",
              borderRadius: "12px",
              color: "#ffffff",
              fontSize: "13px",
              fontWeight: "800",
              cursor: "pointer",
              boxShadow: `0 4px 18px ${config.bgGlow}`,
              transition: "transform 0.15s ease, opacity 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "0.92";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "1";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            {textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
