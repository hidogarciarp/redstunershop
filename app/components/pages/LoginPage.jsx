"use client";
import React, { useState } from "react";
import {
  Eye,
  EyeOff,
  History,
  LockKeyhole,
  ShieldCheck,
  UserRound,
  UsersRound,
  Wrench,
} from "lucide-react";

export default function LoginPage({
  idInputLogin,
  setIdInputLogin,
  senhaInputLogin,
  setSenhaInputLogin,
  realizarLogin,
  erroLogin = "",
  setErroLogin = () => {},
  carregandoLogin = false,
}) {
  const [mostrarSenha, setMostrarSenha] = useState(false);

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
      @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Inter:wght@400;500;600;700&display=swap');
      
      @keyframes fadeInLayout {
        0% { opacity: 0; filter: blur(5px); }
        100% { opacity: 1; filter: blur(0); }
      }
      @keyframes slideRight {
        0% { opacity: 0; transform: translateX(-30px); }
        100% { opacity: 1; transform: translateX(0); }
      }
      @keyframes slideLeft {
        0% { opacity: 0; transform: translateX(30px); }
        100% { opacity: 1; transform: translateX(0); }
      }
      @keyframes backgroundReveal {
        0% { opacity: 0.45; filter: brightness(0.48) blur(7px); transform: scale(1.025); }
        100% { opacity: 1; filter: brightness(1) blur(0); transform: scale(1); }
      }
      @keyframes contentReveal {
        0% { opacity: 0; transform: translateY(16px); }
        100% { opacity: 1; transform: translateY(0); }
      }
      @keyframes loginReveal {
        0% { opacity: 0; transform: translateX(24px) scale(0.985); }
        100% { opacity: 1; transform: translateX(0) scale(1); }
      }
      @keyframes errorReveal {
        0% { opacity: 0; transform: translateY(-6px); }
        100% { opacity: 1; transform: translateY(0); }
      }
      @keyframes loginSpin { to { transform: rotate(360deg); } }
      
      .premium-bg {
        width: 100%;
        height: 100svh;
        min-height: 620px;
        box-sizing: border-box;
        background-color: #0c0c0c;
        background-image:
          linear-gradient(90deg, rgba(5,8,13,0.30) 0%, rgba(5,8,13,0.12) 46%, rgba(5,8,13,0.52) 100%),
          linear-gradient(0deg, rgba(3,6,10,0.42) 0%, transparent 38%, rgba(3,6,10,0.18) 100%),
          url('/bg.png');
        background-size: cover;
        background-position: center, center, center 46%;
        background-repeat: no-repeat;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        font-family: 'Inter', sans-serif;
        padding: clamp(20px, 4vw, 54px);
        overflow: hidden;
        animation: backgroundReveal 0.7s ease-out both;
      }
      /* Faint grid background */
      .premium-bg::before {
        content: '';
        position: absolute;
        inset: 0;
        background-image: 
          linear-gradient(rgba(255,255,255,0.016) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.016) 1px, transparent 1px);
        background-size: 40px 40px;
        pointer-events: none;
      }
      /* Subtle red glow left */
      .glow-left {
        position: absolute;
        left: -20vw;
        top: 10vh;
        width: 50vw;
        height: 80vh;
        background: radial-gradient(circle, rgba(180, 13, 13, 0.08) 0%, transparent 62%);
        filter: blur(80px);
        pointer-events: none;
      }
      
      .container {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        max-width: 1100px;
        z-index: 10;
        gap: 60px;
      }
      
      @media (max-width: 900px) {
        .container {
          flex-direction: column;
          justify-content: center;
          text-align: center;
        }
        .left-col {
          align-items: center !important;
        }
        .hq-desc {
          text-align: center !important;
        }
        .badges-row {
          justify-content: center;
        }
      }
      
      /* Left Column */
      .left-col {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        animation: none;
        padding: 30px 32px;
        border-radius: 22px;
        background: linear-gradient(90deg, rgba(4,7,12,0.62), rgba(4,7,12,0.20) 82%, transparent);
        text-shadow: 0 3px 18px rgba(0,0,0,0.95);
        align-self: center;
        margin-bottom: 0;
      }
      .subtitle {
        color: #f59e0b;
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 5px;
        text-transform: uppercase;
        margin-bottom: 20px;
        opacity: 0;
        animation: contentReveal 0.42s ease-out 0.52s both;
      }
      .intro-title {
        max-width: 520px;
        margin: 0 0 14px;
        color: #fff;
        font-family: 'Orbitron', 'Inter', sans-serif;
        font-size: clamp(25px, 2.8vw, 39px);
        line-height: 1.16;
        letter-spacing: -0.7px;
        text-wrap: balance;
        opacity: 0;
        animation: contentReveal 0.46s ease-out 0.67s both;
      }
      .hq-desc {
        color: #d5dde8;
        font-size: 16px;
        line-height: 1.6;
        margin: 0 0 28px 0;
        max-width: 480px;
        text-align: left;
        opacity: 0;
        animation: contentReveal 0.46s ease-out 0.74s both;
      }
      .badges-row {
        display: flex;
        gap: 16px;
        flex-wrap: wrap;
      }
      .feat-badge {
        color: #fbbf24;
        border: 1px solid rgba(245, 158, 11, 0.48);
        background: rgba(7, 10, 15, 0.48);
        backdrop-filter: blur(6px);
        padding: 8px 20px;
        border-radius: 100px;
        font-size: 13px;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        opacity: 0;
        animation: contentReveal 0.4s ease-out both;
      }
      .feat-badge:nth-child(1) { animation-delay: 0.82s; }
      .feat-badge:nth-child(2) { animation-delay: 0.89s; }
      .feat-badge:nth-child(3) { animation-delay: 0.96s; }
      .feat-badge:nth-child(4) { animation-delay: 1.03s; }
      .feat-badge svg { width: 15px; height: 15px; stroke-width: 1.8; }
      
      /* Right Column */
      .right-col {
        flex: 1;
        display: flex;
        justify-content: flex-end;
        opacity: 0;
        animation: loginReveal 0.48s cubic-bezier(0.16, 1, 0.3, 1) 1.05s both;
      }
      .login-card {
        width: 100%;
        max-width: 420px;
        background: linear-gradient(145deg, rgba(18, 20, 24, 0.72), rgba(8, 10, 14, 0.64));
        backdrop-filter: blur(12px) saturate(115%);
        -webkit-backdrop-filter: blur(12px) saturate(115%);
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 24px;
        padding: 40px;
        box-shadow: 0 24px 70px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,255,255,0.05);
        position: relative;
        overflow: hidden;
      }
      .login-card::before {
        content: '';
        position: absolute;
        top: 0; left: 0; right: 0; height: 1px;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
        opacity: 0.5;
      }
      .card-inner {
        position: relative;
        z-index: 2;
      }
      .card-sub {
        color: #b40d0d;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 2px;
        display: block;
        margin-bottom: 8px;
        text-transform: uppercase;
      }
      .card-title {
        color: #fff;
        font-size: 24px;
        font-weight: 700;
        margin: 0 0 32px 0;
      }
      
      .input-group {
        margin-bottom: 24px;
      }
      .input-shell { position: relative; }
      .input-icon {
        position: absolute;
        left: 16px;
        top: 50%;
        width: 17px;
        height: 17px;
        color: #7d8796;
        transform: translateY(-50%);
        pointer-events: none;
        transition: color 0.2s ease;
      }
      .input-shell:focus-within .input-icon { color: #ef4444; }
      .input-label {
        display: block;
        color: #9ca3af;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 1px;
        margin-bottom: 8px;
        text-transform: uppercase;
      }
      .sys-input {
        width: 100%;
        background: rgba(4,7,12,0.66) !important;
        border: 1px solid rgba(255,255,255,0.1) !important;
        border-radius: 12px;
        padding: 16px 48px 16px 46px;
        color: #fff;
        font-size: 15px;
        outline: none;
        box-sizing: border-box;
        transition: all 0.3s ease;
      }
      .sys-input:focus {
        border-color: #b40d0d !important;
        background: rgba(0,0,0,0.6) !important;
        box-shadow: 0 0 0 4px rgba(180, 13, 13, 0.1);
      }
      .password-toggle {
        position: absolute;
        top: 50%;
        right: 12px;
        width: 34px;
        height: 34px;
        display: grid;
        place-items: center;
        transform: translateY(-50%);
        border: 0;
        border-radius: 8px;
        color: #8993a2;
        background: transparent;
        cursor: pointer;
        transition: color 0.18s ease, background 0.18s ease;
      }
      .password-toggle:hover { color: #fff; background: rgba(255,255,255,0.07); }
      .password-toggle svg { width: 17px; height: 17px; }
      .login-error { animation: errorReveal 0.25s ease-out both; }
      .loading-spinner {
        width: 16px;
        height: 16px;
        display: inline-block;
        border: 2px solid rgba(255,255,255,0.35);
        border-top-color: #fff;
        border-radius: 50%;
        animation: loginSpin 0.7s linear infinite;
      }
      .sys-input::placeholder {
        color: #4b5563;
      }
      
      .sys-button {
        width: 100%;
        background: linear-gradient(135deg, #b40d0d 0%, #b40d0d 100%);
        border: none;
        padding: 18px;
        border-radius: 12px;
        color: #fff;
        font-weight: 700;
        font-size: 15px;
        cursor: pointer;
        transition: all 0.2s ease;
        text-transform: uppercase;
        letter-spacing: 1px;
        box-shadow: 0 8px 30px rgba(180, 13, 13, 0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 9px;
      }
      .sys-button:hover {
        transform: translateY(-2px);
        box-shadow: 0 12px 40px rgba(180, 13, 13, 0.4);
        filter: brightness(1.1);
      }
      .sys-button:active {
        transform: translateY(0);
      }
      
      .card-foot {
        margin-top: 24px;
        text-align: center;
        color: #6b7280;
        font-size: 13px;
      }
      .card-foot strong {
        color: #9ca3af;
      }
      @media (max-height: 700px) and (min-width: 901px) {
        .premium-bg { min-height: 100svh; padding-block: 18px; }
        .login-card { padding: 30px 34px; }
        .input-group { margin-bottom: 18px; }
        .hq-desc { margin-bottom: 26px; }
      }
      @media (max-width: 900px) {
        .premium-bg {
          height: auto;
          min-height: 100svh;
          overflow-y: auto;
          background-position: center, center, 42% center;
        }
        .left-col { padding: 22px; background: rgba(4,7,12,0.42); }
        .intro-title { font-size: clamp(23px, 6vw, 32px); }
        .feat-badge:nth-child(n+3) { display: none; }
        .right-col { width: 100%; justify-content: center; }
        .login-card { max-width: 480px; }
      }
      @media (prefers-reduced-motion: reduce) {
        .premium-bg, .subtitle, .intro-title, .hq-desc, .feat-badge, .right-col, .login-error {
          animation-duration: 0.01ms !important;
          animation-delay: 0ms !important;
        }
        .sys-button, .password-toggle, .sys-input { transition-duration: 0.01ms !important; }
      }
      `
      }} />

      <div className="premium-bg">
        <div className="glow-left"></div>
        <div className="container">
          
          <div className="left-col">
            <div className="subtitle">PERFORMANCE GARAGE</div>
            <h1 className="intro-title">Gestão completa da oficina em um único lugar.</h1>
            <p className="hq-desc">
              Controle de atendimentos, funcionários, serviços, veículos e movimentações com acesso rápido e organizado.
            </p>

            <div className="badges-row">
              <div className="feat-badge"><Wrench aria-hidden="true" /> Gestão de Serviços</div>
              <div className="feat-badge"><UsersRound aria-hidden="true" /> Controle de Equipe</div>
              <div className="feat-badge"><History aria-hidden="true" /> Histórico de Atendimentos</div>
              <div className="feat-badge"><ShieldCheck aria-hidden="true" /> Painel Administrativo</div>
            </div>
          </div>

          <div className="right-col">
            <div className="login-card">
              <div className="card-inner">
                <span className="card-sub">ACESSO RESTRITO</span>
                <h2 className="card-title">Sistema de Gestão Interno</h2>

                {erroLogin && (
                  <div
                    className="login-error"
                    style={{
                      background: "rgba(239, 68, 68, 0.15)",
                      border: "1px solid rgba(239, 68, 68, 0.4)",
                      color: "#fca5a5",
                      padding: "12px 16px",
                      borderRadius: "12px",
                      fontSize: "13px",
                      fontWeight: "600",
                      marginBottom: "20px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      lineHeight: "1.4"
                    }}
                  >
                    <ShieldCheck size={17} aria-hidden="true" />
                    <span>{erroLogin}</span>
                  </div>
                )}

                <div className="input-group">
                  <label className="input-label">PASSAPORTE (ID)</label>
                  <div className="input-shell">
                    <UserRound className="input-icon" aria-hidden="true" />
                    <input
                      className="sys-input"
                      inputMode="numeric"
                      autoComplete="username"
                      placeholder="Digite seu passaporte"
                      value={idInputLogin}
                      onChange={(e) => {
                        if (erroLogin) setErroLogin("");
                        setIdInputLogin(e.target.value.replace(/\D/g, ""));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !carregandoLogin) {
                          e.preventDefault();
                          realizarLogin(idInputLogin, senhaInputLogin);
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label className="input-label">SENHA</label>
                  <div className="input-shell">
                    <LockKeyhole className="input-icon" aria-hidden="true" />
                    <input
                      type={mostrarSenha ? "text" : "password"}
                      className="sys-input"
                      autoComplete="current-password"
                      placeholder="Digite sua senha"
                      value={senhaInputLogin}
                      onChange={(e) => {
                        if (erroLogin) setErroLogin("");
                        setSenhaInputLogin(e.target.value);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !carregandoLogin) {
                          e.preventDefault();
                          realizarLogin(idInputLogin, senhaInputLogin);
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setMostrarSenha((atual) => !atual)}
                      aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                      title={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {mostrarSenha ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  className="sys-button"
                  disabled={carregandoLogin}
                  style={{
                    opacity: carregandoLogin ? 0.7 : 1,
                    cursor: carregandoLogin ? "not-allowed" : "pointer"
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    if (!carregandoLogin) {
                      realizarLogin(idInputLogin, senhaInputLogin);
                    }
                  }}
                >
                  {carregandoLogin && <span className="loading-spinner" aria-hidden="true" />}
                  {carregandoLogin ? "Acessando..." : "Acessar Sistema"}
                </button>

                <div className="card-foot">
                  Primeiro acesso? Use seu <strong>ID como senha</strong>.
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
