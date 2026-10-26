"use client";
import React, { useState, useEffect } from "react";
import { supabase } from "../../utils/supabaseClient";
import ModalConfirmacaoDialog from "../ModalConfirmacaoDialog";

// Marco zero oficial das cobranças semanais da Red's Tunershop:
// Cobrança formal começa da semana atual (12/10/2026) em diante.
const DATA_MARCO_ZERO = "2026-10-12";

export default function FinancasPage({
  styles,
  theme,
  userPodeFinancas,
  setPaginaAtual,
  buscarFinancas,
  buscarPagamentosSemanais,
  financasCarregando,
  pagamentosSemanais = [],
  formatarDataHora,
  confirmarPagamentoSemanal,
  financasFuncionarios = [],
  getLabelCargo,
  editandoFinancaId,
  editFinancaValor,
  setEditFinancaValor,
  editFinancaVencimento,
  setEditFinancaVencimento,
  editFinancaRenovacao,
  setEditFinancaRenovacao,
  salvarFinancaFuncionario,
  setEditandoFinancaId,
  formatarData,
  iniciarEdicaoFinanca,
  desbloquearFuncionario,
  bloquearFuncionario,
  reabrirPagamento,
  isAdminOuDono,
  usuarioLogado,
  apagarPagamento,
  AppHeaderBar,
  AppModalNotificacao,
  registrarPagamentoManual,
  atualizarVencimentoManual,
  enviarNotificacao,
  mostrarFeedback,
}) {
  const [funcSelecionado, setFuncSelecionado] = useState(null);
  const [linksTemporarios, setLinksTemporarios] = useState({});
  const [rowsEmEdicao, setRowsEmEdicao] = useState({});
  const [subAba, setSubAba] = useState("geral"); // "geral" | "devedores"
  const [filtroFila, setFiltroFila] = useState("pendentes"); // "pendentes" | "todos" | "aprovados" | "bloqueados" | "comprovante"
  const [buscaFila, setBuscaFila] = useState("");
  const [modalContratacoesSemCobranca, setModalContratacoesSemCobranca] = useState(false);
  const [dialogConfig, setDialogConfig] = useState(null);
  const [executandoLote, setExecutandoLote] = useState(false);

  // Regra padrão de validação de funcionário com perfil ativo
  const isMecanicoAtivo = (func) => {
    if (!func) return false;
    const statusLower = (func.status || "ativo").toLowerCase().trim();
    if (func.status && statusLower !== "ativo") return false;
    if (statusLower !== "ativo" && func.data_demissao) return false;
    if (func.oculto_hierarquia) return false;

    const r = (func.role || "").split("|")[0].toLowerCase().trim();
    if (r === "user" || r === "admin") return false;

    const nomeLower = (func.nome || func.nome_personagem || "").toLowerCase().trim();
    if (
      nomeLower.startsWith("staff ") ||
      nomeLower.startsWith("staff_") ||
      (nomeLower.startsWith("staff") && nomeLower.length <= 6) ||
      nomeLower.startsWith("admin ") ||
      nomeLower.startsWith("teste") ||
      nomeLower === "testes" ||
      nomeLower === "teste login"
    ) {
      return false;
    }
    return true;
  };

  const funcsAtivos = financasFuncionarios.filter(isMecanicoAtivo);
  const idsAtivos = new Set(funcsAtivos.map((f) => f.id));
  const pagamentosAtivos = pagamentosSemanais.filter((p) => idsAtivos.has(p.funcionario_id));

  const qtdPendentesComprovante = pagamentosAtivos.filter((p) => !p.confirmado && p.comprovante_link).length;

  // Helper para abrir modais flutuantes de alerta/confirmação
  const abrirDialogo = ({ tipo = "info", titulo, mensagem, onConfirmar, onCancelar, textoConfirmar = "OK", textoCancelar = "Cancelar", valorInputPadrao = "", placeholderInput = "" }) => {
    setDialogConfig({
      tipo,
      titulo,
      mensagem,
      onConfirmar: async (val) => {
        setDialogConfig(null);
        if (typeof onConfirmar === "function") await onConfirmar(val);
      },
      onCancelar: () => {
        setDialogConfig(null);
        if (typeof onCancelar === "function") onCancelar();
      },
      textoConfirmar,
      textoCancelar,
      valorInputPadrao,
      placeholderInput,
    });
  };

  const podeAcessar = typeof userPodeFinancas === "function"
    ? userPodeFinancas()
    : Boolean(userPodeFinancas) || (isAdminOuDono && isAdminOuDono(usuarioLogado?.role));

  if (!podeAcessar) {
    return (
      <div style={styles.dashContainer}>
        <AppModalNotificacao />
        <AppHeaderBar />
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh", padding: "20px" }}>
          <div style={{ ...styles.whiteCard, maxWidth: "480px", textAlign: "center", padding: "40px 30px" }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>🚫</div>
            <h2 style={{ color: "#ef4444", margin: "0 0 10px" }}>Acesso Restrito</h2>
            <p style={{ color: theme.subtext, fontSize: "14px", lineHeight: "1.5" }}>
              Apenas Donos, Administradores e Gerentes autorizados possuem permissão para acessar o módulo de Gestão Financeira.
            </p>
            <button
              style={{ ...styles.btnPrimary, width: "auto", margin: "20px auto 0", padding: "10px 24px" }}
              onClick={() => setPaginaAtual("dashboard")}
            >
              Voltar ao Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

  const calcularVencimentoPrimeiraCobranca = (dataAdmissao) => {
    if (!dataAdmissao) return "";
    const admDate = new Date(dataAdmissao + "T12:00:00");
    const day = admDate.getDay();
    const diffParaSegunda = day === 0 ? -6 : 1 - day;
    const segundaAdm = new Date(admDate);
    segundaAdm.setDate(admDate.getDate() + diffParaSegunda);

    const domingoSeguinte = new Date(segundaAdm);
    domingoSeguinte.setDate(segundaAdm.getDate() + 13);
    return domingoSeguinte.toLocaleDateString("en-CA");
  };

  const sugerirCobrancaPadraoInline = (func) => {
    setEditFinancaValor("100000");
    setEditFinancaRenovacao(true);
    if (func.data_admissao) {
      setEditFinancaVencimento(calcularVencimentoPrimeiraCobranca(func.data_admissao));
    } else {
      const hojeDate = new Date();
      const day = hojeDate.getDay();
      const diffParaDomingo = day === 0 ? 0 : 7 - day;
      const proximoDom = new Date(hojeDate);
      proximoDom.setDate(hojeDate.getDate() + (diffParaDomingo === 0 ? 7 : diffParaDomingo));
      setEditFinancaVencimento(proximoDom.toLocaleDateString("en-CA"));
    }
  };

  const obterContratacoesSemCobranca = () => {
    return funcsAtivos.filter((func) => {
      const semCobranca = !func.data_vencimento || !func.valor_semanal || Number(func.valor_semanal) === 0;
      return semCobranca;
    });
  };

  // Gerar semanas para o dossiê (com marco zero em 12/10/2026)
  const gerarSemanasDossie = (func) => {
    const semanas = [];
    const hojeData = new Date();
    const diaSemana = hojeData.getDay();
    const diffParaSegunda = diaSemana === 0 ? -6 : 1 - diaSemana;

    const segundaAtual = new Date(hojeData);
    segundaAtual.setDate(hojeData.getDate() + diffParaSegunda);
    segundaAtual.setHours(12, 0, 0, 0);

    const dataMarcoZeroObj = new Date(DATA_MARCO_ZERO + "T12:00:00");

    for (let i = 0; i < 15; i++) {
      const s = new Date(segundaAtual);
      s.setDate(segundaAtual.getDate() - i * 7);

      const dom = new Date(s);
      dom.setDate(s.getDate() + 6);

      const fD = (d) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = `Semana de ${fD(s)} até ${fD(dom)}`;

      const isAnteriorMarcoZero = s < dataMarcoZeroObj;

      // Filtrar por data de admissão se o funcionário entrou depois
      if (func?.data_admissao) {
        const adm = new Date(func.data_admissao + "T12:00:00");
        const diaS = adm.getDay();
        const diffS = diaS === 0 ? -6 : 1 - diaS;
        const segAdm = new Date(adm);
        segAdm.setDate(adm.getDate() + diffS);
        const domAdm = new Date(segAdm);
        domAdm.setDate(segAdm.getDate() + 6);
        if (dom < domAdm) break;
      }

      semanas.push({
        label,
        inicio: s.toISOString().split("T")[0],
        fim: dom.toISOString().split("T")[0],
        isAtual: i === 0,
        isAnteriorMarcoZero,
      });

      // Se já alcançamos antes do marco zero, paramos por aqui para não poluir
      if (s <= dataMarcoZeroObj) {
        break;
      }
    }
    return semanas;
  };

  const handleUpdateLink = (rowKey, val) => {
    setLinksTemporarios((prev) => ({ ...prev, [rowKey]: val }));
  };

  const handleSalvarPagamento = async (
    pagId,
    funcId,
    funcNome,
    linkExistente = "",
    rowKey,
    semanaLabel = "",
    valorSemanal = 0,
    dataDomingo = null
  ) => {
    const link = linksTemporarios[rowKey] || linkExistente;
    if (!link || !link.trim()) {
      abrirDialogo({
        tipo: "aviso",
        titulo: "Comprovante Necessário",
        mensagem: "Por favor, cole o link do comprovante do Discord antes de salvar a confirmação.",
      });
      return;
    }

    abrirDialogo({
      tipo: "confirmacao",
      titulo: "Confirmar Pagamento Semanal",
      mensagem: `Confirmação de Pagamento Individual:\n\n👤 Funcionário: ${funcNome} (ID: ${funcId})\n📅 Período: ${semanaLabel}\n💰 Valor: $${Number(valorSemanal).toLocaleString("pt-BR")}\n📎 Comprovante: ${link}\n\nO que será realizado:\n• Registro/Aprovação do pagamento para ${funcNome}\n• Regularização do vencimento para o próximo ciclo\n• Desbloqueio de acesso caso estivesse bloqueado\n• Apenas este funcionário será alterado`,
      textoConfirmar: "Sim, Confirmar Pagamento",
      textoCancelar: "Cancelar",
      onConfirmar: async () => {
        if (pagId) {
          await confirmarPagamentoSemanal(pagId, funcId, funcNome, link, dataDomingo);
        } else {
          await registrarPagamentoManual(funcId, funcNome, valorSemanal, semanaLabel, link, dataDomingo);
        }

        setLinksTemporarios((prev) => {
          const n = { ...prev };
          delete n[rowKey];
          return n;
        });
        setRowsEmEdicao((prev) => {
          const n = { ...prev };
          delete n[rowKey];
          return n;
        });
      },
    });
  };

  const handleNotificarCobranca = (funcId, funcNome, semanaLabel) => {
    const msgPadrao = `⚠️ COBRANÇA FINANCEIRA\nOlá ${funcNome.split(" ")[0]}, notamos que a ${semanaLabel} consta como pendente em seu cadastro. Por favor, realize o envio do comprovante para manter seu acesso em dia.`;
    abrirDialogo({
      tipo: "prompt",
      titulo: `Notificar ${funcNome}`,
      mensagem: "Edite o texto da notificação antes de enviar:",
      valorInputPadrao: msgPadrao,
      placeholderInput: "Digite a mensagem de cobrança...",
      textoConfirmar: "Enviar Notificação",
      onConfirmar: async (texto) => {
        if (!texto || !texto.trim()) return;
        const sucesso = await enviarNotificacao(funcId, texto.trim(), false);
        if (sucesso) {
          abrirDialogo({
            tipo: "sucesso",
            titulo: "Notificação Enviada",
            mensagem: `Cobrança enviada com sucesso para ${funcNome}!`,
          });
        }
      },
    });
  };

  // Regularização Geral / Marco Zero (Aprovar todos pagamentos anteriores a 12/10)
  const executarRegularizacaoGeral = () => {
    abrirDialogo({
      tipo: "confirmacao",
      titulo: "Regularizar Períodos Anteriores (Marco Zero)",
      mensagem:
        "Deseja aprovar e anistiar todas as semanas anteriores à semana atual (12/10/2026) para TODOS os mecânicos ativos?\n\nIsso irá:\n• Marcar pendências passadas como confirmadas/isentas\n• Regularizar o vencimento para a semana atual em diante\n• Desbloquear mecânicos que estavam com cobrança atrasada antiga",
      textoConfirmar: "Sim, Regularizar Todos",
      textoCancelar: "Cancelar",
      onConfirmar: async () => {
        setExecutandoLote(true);
        try {
          const agora = new Date().toISOString();
          const { data: pags } = await supabase
            .from("pagamentos_semanais")
            .select("id, observacao")
            .eq("confirmado", false);

          const anteriores = (pags || []).filter((p) => !p.observacao?.includes("Semana de 12/10 até 18/10"));
          const idsAnteriores = anteriores.map((p) => p.id);

          for (let i = 0; i < idsAnteriores.length; i += 50) {
            const chunk = idsAnteriores.slice(i, i + 50);
            await supabase
              .from("pagamentos_semanais")
              .update({
                confirmado: true,
                confirmado_em: agora,
                confirmado_por: usuarioLogado?.id || 643,
              })
              .in("id", chunk);
          }

          // Ajustar funcionários
          const { data: users } = await supabase
            .from("usuarios")
            .select("id, role, data_vencimento, bloqueado_financeiro");

          const paraAjustar = (users || []).filter((u) => {
            const r = u.role?.split("|")[0].toLowerCase().trim();
            if (r === "user" || r === "admin") return false;
            return !u.data_vencimento || u.data_vencimento < "2026-10-18" || u.bloqueado_financeiro;
          });

          for (const u of paraAjustar) {
            await supabase
              .from("usuarios")
              .update({
                data_vencimento: "2026-10-18",
                bloqueado_financeiro: false,
                credito_24h_disponivel: true,
                credito_24h_usado_em: null,
              })
              .eq("id", u.id);
          }

          await buscarFinancas();
          await buscarPagamentosSemanais();

          abrirDialogo({
            tipo: "sucesso",
            titulo: "Regularização Concluída!",
            mensagem: `Todos os pagamentos anteriores a 12/10/2026 foram aprovados e os funcionários estão 100% regulares para a nova cobrança semanal!`,
          });
        } catch (err) {
          abrirDialogo({
            tipo: "erro",
            titulo: "Erro na Regularização",
            mensagem: "Ocorreu um erro ao processar: " + (err.message || String(err)),
          });
        } finally {
          setExecutandoLote(false);
        }
      },
    });
  };

  // Quitar semanas anteriores especificamente deste funcionário
  const quitarSemanasAnterioresFunc = async (func) => {
    if (!func) return;
    abrirDialogo({
      tipo: "confirmacao",
      titulo: `Regularizar ${func.nome}`,
      mensagem: `Confirmação de Regularização Individual:\n\n👤 Funcionário: ${func.nome} (ID: ${func.id})\n\nDeseja isentar e aprovar as semanas anteriores a 12/10/2026 EXCLUSIVAMENTE para ${func.nome}?\n\nO que será realizado:\n• Pendências anteriores a 12/10/2026 deste funcionário serão quitadas\n• O vencimento deste funcionário será ajustado para 18/10/2026\n• Acesso desbloqueado\n• NENHUM OUTRO MECÂNICO SERÁ ALTERADO`,
      textoConfirmar: "Sim, Regularizar Apenas Este",
      textoCancelar: "Cancelar",
      onConfirmar: async () => {
        try {
          const agora = new Date().toISOString();
          const { data: pagsFunc } = await supabase
            .from("pagamentos_semanais")
            .select("id, observacao")
            .eq("funcionario_id", func.id)
            .eq("confirmado", false);

          const ant = (pagsFunc || []).filter((p) => !p.observacao?.includes("Semana de 12/10 até 18/10"));
          if (ant.length > 0) {
            await supabase
              .from("pagamentos_semanais")
              .update({
                confirmado: true,
                confirmado_em: agora,
                confirmado_por: usuarioLogado?.id || 643,
              })
              .in(
                "id",
                ant.map((x) => x.id)
              );
          }

          await supabase
            .from("usuarios")
            .update({
              data_vencimento: "2026-10-18",
              bloqueado_financeiro: false,
              credito_24h_disponivel: true,
            })
            .eq("id", func.id);

          await buscarFinancas();
          await buscarPagamentosSemanais();
          setFuncSelecionado((prev) => (prev ? { ...prev, data_vencimento: "2026-10-18", bloqueado_financeiro: false } : null));

          abrirDialogo({
            tipo: "sucesso",
            titulo: "Mecânico Regularizado!",
            mensagem: `Todas as pendências antigas de ${func.nome} foram aprovadas com sucesso!`,
          });
        } catch (e) {
          abrirDialogo({
            tipo: "erro",
            titulo: "Erro",
            mensagem: "Não foi possível regularizar: " + e.message,
          });
        }
      },
    });
  };

  // MODAL FLUTUANTE MODERNO: DOSSIÊ DO MECÂNICO
  const renderModalHistorico = () => {
    if (!funcSelecionado) return null;
    const semanas = gerarSemanasDossie(funcSelecionado);
    const historicoFunc = pagamentosSemanais.filter((p) => p.funcionario_id === funcSelecionado.id);

    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(3, 3, 5, 0.86)",
          zIndex: 100000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backdropFilter: "blur(16px)",
          padding: "20px",
          animation: "modalOverlayFade 0.2s ease-out",
        }}
      >
        <div
          style={{
            background: "linear-gradient(180deg, #18181b 0%, #0d0d10 100%)",
            width: "100%",
            maxWidth: "1080px",
            borderRadius: "26px",
            overflow: "hidden",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            boxShadow: "0 35px 80px -15px rgba(0,0,0,0.9), 0 0 35px rgba(180,13,13,0.15)",
            display: "flex",
            flexDirection: "column",
            maxHeight: "90vh",
            animation: "modalBoxPop 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          {/* CABEÇALHO DO DOSSIÊ */}
          <div
            style={{
              padding: "22px 28px",
              background: "rgba(255,255,255,0.03)",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "14px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div
                style={{
                  width: "50px",
                  height: "50px",
                  borderRadius: "16px",
                  background: "linear-gradient(135deg, #b40d0d 0%, #ef4444 100%)",
                  display: "grid",
                  placeItems: "center",
                  fontSize: "20px",
                  fontWeight: "900",
                  color: "#fff",
                  boxShadow: "0 4px 16px rgba(180,13,13,0.4)",
                }}
              >
                {funcSelecionado.nome?.[0]?.toUpperCase() || "M"}
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <h2 style={{ margin: 0, color: "#fff", fontSize: "19px", fontWeight: "900" }}>
                    {funcSelecionado.nome}
                  </h2>
                  <span
                    style={{
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.14)",
                      color: "#e4e4e7",
                      padding: "2px 8px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: "700",
                    }}
                  >
                    ID: {funcSelecionado.id}
                  </span>
                  <span
                    style={{
                      background: "rgba(234,179,8,0.14)",
                      border: "1px solid rgba(234,179,8,0.3)",
                      color: "#facc15",
                      padding: "2px 8px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: "800",
                    }}
                  >
                    {getLabelCargo(funcSelecionado.role)}
                  </span>
                </div>
                <div style={{ color: "#a1a1aa", fontSize: "12px", marginTop: "4px", display: "flex", gap: "14px", flexWrap: "wrap" }}>
                  {funcSelecionado.data_admissao && (
                    <span>📅 Admissão: <b style={{ color: "#fff" }}>{formatarData(funcSelecionado.data_admissao)}</b></span>
                  )}
                  <span>
                    📅 Vencimento Atual:{" "}
                    <b style={{ color: funcSelecionado.data_vencimento < hoje ? "#ef4444" : "#22c55e" }}>
                      {funcSelecionado.data_vencimento ? formatarData(funcSelecionado.data_vencimento) : "Não definido"}
                    </b>
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                type="button"
                onClick={() => quitarSemanasAnterioresFunc(funcSelecionado)}
                style={{
                  background: "rgba(56,189,248,0.12)",
                  border: "1px solid rgba(56,189,248,0.35)",
                  color: "#38bdf8",
                  padding: "9px 16px",
                  borderRadius: "10px",
                  cursor: "pointer",
                  fontWeight: "800",
                  fontSize: "11px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                ✨ Quitar Anteriores
              </button>

              <button
                type="button"
                onClick={() => setFuncSelecionado(null)}
                style={{
                  width: "36px",
                  height: "36px",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#fff",
                  borderRadius: "10px",
                  cursor: "pointer",
                  fontWeight: "800",
                  fontSize: "16px",
                  display: "grid",
                  placeItems: "center",
                  transition: "all 0.18s",
                }}
                title="Fechar"
              >
                ✕
              </button>
            </div>
          </div>

          {/* TABELA DE SEMANAS */}
          <div style={{ padding: "20px 28px", overflowY: "auto", flex: 1 }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 8px" }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={{ padding: "8px 14px", color: "#71717a", fontSize: "11px", textTransform: "uppercase" }}>
                    Período Semanal
                  </th>
                  <th style={{ padding: "8px 14px", color: "#71717a", fontSize: "11px", textTransform: "uppercase" }}>
                    Valor
                  </th>
                  <th style={{ padding: "8px 14px", color: "#71717a", fontSize: "11px", textTransform: "uppercase" }}>
                    Comprovante
                  </th>
                  <th style={{ padding: "8px 14px", color: "#71717a", fontSize: "11px", textTransform: "uppercase", textAlign: "center" }}>
                    Status & Ação
                  </th>
                </tr>
              </thead>
              <tbody>
                {semanas.map((sem, idx) => {
                  const pag =
                    historicoFunc
                      .filter((p) => p.observacao?.includes(sem.label))
                      .sort((a, b) => {
                        if (a.confirmado && !b.confirmado) return -1;
                        if (!a.confirmado && b.confirmado) return 1;
                        if (a.comprovante_link && !b.comprovante_link) return -1;
                        if (!a.comprovante_link && b.comprovante_link) return 1;
                        return new Date(b.criado_em || 0) - new Date(a.criado_em || 0);
                      })[0] ||
                    historicoFunc
                      .filter((p) => {
                        const temOutroLabel = semanas.some((s) => s.label !== sem.label && p.observacao?.includes(s.label));
                        if (temOutroLabel) return false;
                        return p.criado_em >= sem.inicio && p.criado_em <= sem.fim + "T23:59:59";
                      })
                      .sort((a, b) => {
                        if (a.confirmado && !b.confirmado) return -1;
                        if (!a.confirmado && b.confirmado) return 1;
                        if (a.comprovante_link && !b.comprovante_link) return -1;
                        if (!a.comprovante_link && b.comprovante_link) return 1;
                        return new Date(b.criado_em || 0) - new Date(a.criado_em || 0);
                      })[0];

                  const rowKey = `row-${funcSelecionado.id}-${idx}`;
                  const isConfirmado = pag?.confirmado;
                  const emEdicao = rowsEmEdicao[rowKey];
                  const linkAtual = linksTemporarios[rowKey] || pag?.comprovante_link || "";
                  const valorDaSemana = pag?.valor || funcSelecionado.valor_semanal || 0;

                  return (
                    <tr
                      key={idx}
                      style={{
                        background: isConfirmado ? "rgba(34,197,94,0.04)" : "rgba(255,255,255,0.025)",
                        border: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <td style={{ padding: "14px 16px", borderRadius: "12px 0 0 12px" }}>
                        <div style={{ color: "#fff", fontWeight: "700", fontSize: "13.5px" }}>{sem.label}</div>
                        <div style={{ fontSize: "10.5px", color: sem.isAtual ? "#22c55e" : "#a1a1aa", marginTop: "3px" }}>
                          {sem.isAtual ? "🌟 SEMANA ATUAL" : sem.isAnteriorMarcoZero ? "🛡️ Isento / Marco Zero" : "🕒 Semana Passada"}
                        </div>
                      </td>

                      <td style={{ padding: "14px 16px", color: "#facc15", fontWeight: "800", fontSize: "14px" }}>
                        ${Number(valorDaSemana).toLocaleString("pt-BR")}
                      </td>

                      <td style={{ padding: "14px 16px" }}>
                        {!isConfirmado || emEdicao ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <input
                              placeholder="Cole o link do comprovante..."
                              value={linkAtual}
                              onChange={(e) => handleUpdateLink(rowKey, e.target.value)}
                              style={{
                                background: "rgba(0,0,0,0.5)",
                                border: "1px solid rgba(255,255,255,0.12)",
                                borderRadius: "8px",
                                color: "#fff",
                                padding: "8px 12px",
                                fontSize: "12px",
                                outline: "none",
                                flex: 1,
                              }}
                            />
                            {linkAtual && (
                              <a
                                href={linkAtual}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  background: "rgba(56,189,248,0.15)",
                                  border: "1px solid rgba(56,189,248,0.3)",
                                  color: "#38bdf8",
                                  padding: "7px 10px",
                                  borderRadius: "8px",
                                  fontSize: "12px",
                                  textDecoration: "none",
                                  fontWeight: "700",
                                }}
                              >
                                🔗 Abrir
                              </a>
                            )}
                          </div>
                        ) : pag?.comprovante_link ? (
                          <a
                            href={pag.comprovante_link}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              color: "#38bdf8",
                              fontSize: "12px",
                              fontWeight: "700",
                              textDecoration: "none",
                              background: "rgba(56,189,248,0.1)",
                              border: "1px solid rgba(56,189,248,0.25)",
                              padding: "4px 10px",
                              borderRadius: "6px",
                              display: "inline-block",
                            }}
                          >
                            📎 Ver Comprovante
                          </a>
                        ) : (
                          <span style={{ color: "#71717a", fontSize: "12px" }}>Sem anexo</span>
                        )}
                      </td>

                      <td style={{ padding: "14px 16px", borderRadius: "0 12px 12px 0", textAlign: "center" }}>
                        {!isConfirmado || emEdicao ? (
                          <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                            <button
                              type="button"
                              onClick={() =>
                                handleSalvarPagamento(
                                  pag?.id,
                                  funcSelecionado.id,
                                  funcSelecionado.nome,
                                  pag?.comprovante_link,
                                  rowKey,
                                  sem.label,
                                  valorDaSemana,
                                  sem.fim
                                )
                              }
                              style={{
                                background: "linear-gradient(135deg, #15803d 0%, #16a34a 100%)",
                                color: "#fff",
                                border: "none",
                                padding: "8px 16px",
                                borderRadius: "8px",
                                fontWeight: "800",
                                cursor: "pointer",
                                fontSize: "11px",
                              }}
                            >
                              💾 SALVAR
                            </button>
                            {!isConfirmado && (
                              <button
                                type="button"
                                onClick={() => handleNotificarCobranca(funcSelecionado.id, funcSelecionado.nome, sem.label)}
                                style={{
                                  background: "rgba(249,115,22,0.12)",
                                  border: "1px solid rgba(249,115,22,0.3)",
                                  color: "#f97316",
                                  padding: "8px 10px",
                                  borderRadius: "8px",
                                  fontWeight: "800",
                                  cursor: "pointer",
                                  fontSize: "11px",
                                }}
                                title="Notificar funcionário"
                              >
                                🔔
                              </button>
                            )}
                          </div>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                            <span style={{ color: "#22c55e", fontWeight: "800", fontSize: "13px" }}>✅ OK</span>
                            <button
                              type="button"
                              onClick={() => setRowsEmEdicao((prev) => ({ ...prev, [rowKey]: true }))}
                              style={{
                                background: "transparent",
                                border: "1px solid rgba(255,255,255,0.12)",
                                color: "#a1a1aa",
                                padding: "4px 8px",
                                borderRadius: "6px",
                                fontSize: "10px",
                                cursor: "pointer",
                                fontWeight: "700",
                              }}
                            >
                              ✏️ Editar
                            </button>
                            {pag && (
                              <button
                                type="button"
                                onClick={() => {
                                  abrirDialogo({
                                    tipo: "perigo",
                                    titulo: "Apagar Pagamento",
                                    mensagem: "Tem certeza que deseja apagar este pagamento e reabri-lo?",
                                    textoConfirmar: "Sim, Apagar",
                                    onConfirmar: () => apagarPagamento(pag.id),
                                  });
                                }}
                                style={{
                                  background: "rgba(239,68,68,0.1)",
                                  border: "1px solid rgba(239,68,68,0.25)",
                                  color: "#ef4444",
                                  padding: "4px 8px",
                                  borderRadius: "6px",
                                  fontSize: "10px",
                                  cursor: "pointer",
                                }}
                              >
                                🗑️
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // MODAL FLUTUANTE MODERNO: CONTRATAÇÕES SEM COBRANÇA
  const renderModalContratacoesSemCobranca = () => {
    if (!modalContratacoesSemCobranca) return null;
    const listaPendentes = obterContratacoesSemCobranca();

    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(3,3,5,0.85)",
          zIndex: 100000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backdropFilter: "blur(14px)",
          padding: "20px",
        }}
      >
        <div
          style={{
            background: "linear-gradient(180deg, #18181b 0%, #0d0d10 100%)",
            width: "100%",
            maxWidth: "760px",
            borderRadius: "24px",
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow: "0 35px 80px rgba(0,0,0,0.85)",
            display: "flex",
            flexDirection: "column",
            maxHeight: "85vh",
          }}
        >
          <div
            style={{
              padding: "20px 24px",
              background: "rgba(255,255,255,0.03)",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <h2 style={{ margin: 0, color: "#fff", fontSize: "18px", fontWeight: "900" }}>
                🔍 Contratações Sem Cobrança
              </h2>
              <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#a1a1aa" }}>
                Funcionários ativos que ainda não possuem taxa semanal configurada
              </p>
            </div>
            <button
              type="button"
              onClick={() => setModalContratacoesSemCobranca(false)}
              style={{
                width: "34px",
                height: "34px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#fff",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "800",
                fontSize: "14px",
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
            {listaPendentes.length === 0 ? (
              <div style={{ padding: "40px 10px", textAlign: "center", color: "#a1a1aa" }}>
                <div style={{ fontSize: "32px", marginBottom: "8px" }}>🎉</div>
                <div style={{ fontWeight: "700", color: "#22c55e", fontSize: "15px" }}>Tudo em dia!</div>
                <p style={{ fontSize: "12px", marginTop: "4px" }}>
                  Nenhum funcionário ativo está sem cobrança cadastrada.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {listaPendentes.map((func) => {
                  const vencSugerido = func.data_admissao
                    ? calcularVencimentoPrimeiraCobranca(func.data_admissao)
                    : null;
                  return (
                    <div
                      key={func.id}
                      style={{
                        background: "rgba(255,255,255,0.025)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: "14px",
                        padding: "14px 18px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "12px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <div style={{ color: "#fff", fontWeight: "800", fontSize: "14px" }}>{func.nome}</div>
                        <div style={{ color: "#a1a1aa", fontSize: "11px", marginTop: "2px" }}>
                          ID: {func.id} · {getLabelCargo(func.role)} · Admissão:{" "}
                          <strong style={{ color: "#fff" }}>
                            {func.data_admissao ? formatarData(func.data_admissao) : "Sem data"}
                          </strong>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "11px", color: "#facc15", fontWeight: "700" }}>
                          Sugerido: {vencSugerido ? formatarData(vencSugerido) : "18/10/2026"}
                        </span>
                        <button
                          type="button"
                          onClick={async () => {
                            const venc = vencSugerido || "2026-10-18";
                            const { error } = await supabase
                              .from("usuarios")
                              .update({
                                valor_semanal: 100000,
                                data_vencimento: venc,
                                renovacao_auto: true,
                              })
                              .eq("id", func.id);

                            if (error) {
                              abrirDialogo({
                                tipo: "erro",
                                titulo: "Erro",
                                mensagem: "Erro ao ativar cobrança: " + error.message,
                              });
                            } else {
                              abrirDialogo({
                                tipo: "sucesso",
                                titulo: "Cobrança Ativada!",
                                mensagem: `Cobrança padrão ativada para ${func.nome} com vencimento em ${formatarData(venc)}!`,
                              });
                              buscarFinancas();
                            }
                          }}
                          style={{
                            background: "linear-gradient(135deg, #15803d 0%, #16a34a 100%)",
                            color: "#fff",
                            border: "none",
                            padding: "8px 14px",
                            borderRadius: "8px",
                            fontSize: "11px",
                            fontWeight: "800",
                            cursor: "pointer",
                          }}
                        >
                          🚀 Ativar $100k
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // RESUMO DE ATRASOS (APENAS A PARTIR DO MARCO ZERO)
  const renderResumoAtrasos = () => {
    const devedoresMap = {};

    funcsAtivos.forEach((func) => {
      const semanasEsperadas = gerarSemanasDossie(func);
      const historicoFunc = pagamentosAtivos.filter((p) => p.funcionario_id === func.id);

      const pendencias = [];
      let totalDevido = 0;

      semanasEsperadas.forEach((sem, idx) => {
        // Ignora semana atual e qualquer semana anterior ao marco zero
        if (idx === 0 || sem.isAnteriorMarcoZero) return;

        const pag =
          historicoFunc.find((p) => p.observacao?.includes(sem.label)) ||
          historicoFunc.find((p) => {
            const temOutroLabel = semanasEsperadas.some((s) => s.label !== sem.label && p.observacao?.includes(s.label));
            if (temOutroLabel) return false;
            return p.criado_em >= sem.inicio && p.criado_em <= sem.fim + "T23:59:59";
          });

        if (!pag || !pag.confirmado) {
          pendencias.push({
            label: sem.label,
            valor: pag?.valor || func.valor_semanal || 0,
            comprovante: pag?.comprovante_link || null,
          });
          totalDevido += Number(pag?.valor || func.valor_semanal || 0);
        }
      });

      if (pendencias.length > 0) {
        devedoresMap[func.id] = {
          id: func.id,
          nome: func.nome,
          total: totalDevido,
          semanas: pendencias,
        };
      }
    });

    const listaDevedores = Object.values(devedoresMap).sort((a, b) => b.total - a.total);

    return (
      <div style={{ ...styles.whiteCard, animation: "fadeLogin 0.3s ease" }}>
        <div style={{ ...styles.cardHeader, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span style={{ ...styles.dot, background: "#ef4444" }}></span>
            <span style={{ color: "#ef4444" }}>Relatório de Débitos Pendentes (Marco Zero: 12/10 em diante)</span>
          </div>
          <span style={{ fontSize: "11px", color: theme.subtext }}>
            Total devedores: <b style={{ color: "#fff" }}>{listaDevedores.length}</b>
          </span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ background: theme.card2, textAlign: "left" }}>
                <th style={{ padding: "12px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", textTransform: "uppercase", color: theme.subtext }}>
                  Funcionário
                </th>
                <th style={{ padding: "12px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", textTransform: "uppercase", color: theme.subtext }}>
                  Qtd Pendente
                </th>
                <th style={{ padding: "12px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", textTransform: "uppercase", color: theme.subtext }}>
                  Total Devido
                </th>
                <th style={{ padding: "12px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", textTransform: "uppercase", color: theme.subtext }}>
                  Semanas Pendentes
                </th>
                <th style={{ padding: "12px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", textTransform: "uppercase", color: theme.subtext, textAlign: "right" }}>
                  Ação
                </th>
              </tr>
            </thead>
            <tbody>
              {listaDevedores.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: "40px", textAlign: "center", color: theme.subtext }}>
                    <div style={{ fontSize: "28px", marginBottom: "8px" }}>🚀</div>
                    <div style={{ fontWeight: "700", color: "#22c55e", fontSize: "15px" }}>Tudo em dia!</div>
                    <div style={{ fontSize: "12px", marginTop: "2px" }}>
                      Nenhum mecânico possui pendências financeiras no ciclo atual.
                    </div>
                  </td>
                </tr>
              ) : (
                listaDevedores.map((dev) => (
                  <tr key={dev.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                    <td style={{ padding: "14px 12px", color: theme.text }}>
                      <div style={{ fontWeight: "700" }}>{dev.nome}</div>
                      <div style={{ fontSize: "10px", color: theme.subtext }}>ID: {dev.id}</div>
                    </td>
                    <td style={{ padding: "14px 12px" }}>
                      <span style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", padding: "4px 10px", borderRadius: "10px", fontWeight: "700", fontSize: "12px" }}>
                        {dev.semanas.length} {dev.semanas.length === 1 ? "semana" : "semanas"}
                      </span>
                    </td>
                    <td style={{ padding: "14px 12px", color: "#ef4444", fontWeight: "900", fontSize: "14px" }}>
                      ${dev.total.toLocaleString("pt-BR")}
                    </td>
                    <td style={{ padding: "14px 12px", fontSize: "11px", color: theme.subtext }}>
                      {dev.semanas.map((s, idx) => (
                        <div key={idx} style={{ marginBottom: "2px" }}>
                          • {s.label} {s.comprovante && <span style={{ color: "#facc15" }}>(Comprovante enviado)</span>}
                        </div>
                      ))}
                    </td>
                    <td style={{ padding: "14px 12px", textAlign: "right" }}>
                      <button
                        type="button"
                        onClick={() => {
                          const f = financasFuncionarios.find((x) => x.id === dev.id);
                          if (f) setFuncSelecionado(f);
                        }}
                        style={{
                          background: theme.accent,
                          color: "#000",
                          border: "none",
                          padding: "8px 14px",
                          borderRadius: "8px",
                          cursor: "pointer",
                          fontWeight: "800",
                          fontSize: "11px",
                        }}
                      >
                        📜 Abrir Dossiê
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // 📥 FILA DE APROVAÇÕES E ÚLTIMOS PAGAMENTOS (Apenas Funcionários Ativos)
  const renderFilaAprovacoes = () => {
    const pendentesComprovante = pagamentosAtivos.filter((p) => !p.confirmado && p.comprovante_link);
    const aprovadosRecentes = pagamentosAtivos.filter((p) => p.confirmado);
    const mecanicosBloqueados = funcsAtivos.filter((f) => f.bloqueado_financeiro);

    let listaFiltrada = [...pagamentosAtivos];

    if (filtroFila === "pendentes") {
      listaFiltrada = listaFiltrada.filter((p) => !p.confirmado);
    } else if (filtroFila === "aprovados") {
      listaFiltrada = listaFiltrada.filter((p) => p.confirmado);
    } else if (filtroFila === "comprovante") {
      listaFiltrada = listaFiltrada.filter((p) => Boolean(p.comprovante_link));
    } else if (filtroFila === "bloqueados") {
      const idsBloqueados = new Set(mecanicosBloqueados.map((m) => m.id));
      listaFiltrada = listaFiltrada.filter((p) => idsBloqueados.has(p.funcionario_id));
    }

    if (buscaFila.trim()) {
      const termo = buscaFila.toLowerCase().trim();
      listaFiltrada = listaFiltrada.filter((p) => {
        const nome = (p.funcionario_nome || "").toLowerCase();
        const idStr = String(p.funcionario_id || "");
        const obs = (p.observacao || "").toLowerCase();
        return nome.includes(termo) || idStr.includes(termo) || obs.includes(termo);
      });
    }

    const listaExibicao = listaFiltrada.slice(0, 150);

    return (
      <div style={{ animation: "fadeLogin 0.25s ease-out" }}>
        {/* CARDS DE RESUMO TOPO */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px", marginBottom: "20px" }}>
          {/* Card 1: Aguardando Confirmação */}
          <div
            onClick={() => setFiltroFila("pendentes")}
            style={{
              background: filtroFila === "pendentes" ? "rgba(250, 204, 21, 0.15)" : theme.card2,
              border: `1.5px solid ${filtroFila === "pendentes" ? "#facc15" : "rgba(250, 204, 21, 0.3)"}`,
              borderRadius: "16px",
              padding: "18px 20px",
              cursor: "pointer",
              transition: "all 0.18s ease",
              boxShadow: filtroFila === "pendentes" ? "0 8px 24px rgba(250, 204, 21, 0.2)" : "none",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontSize: "12px", fontWeight: "800", color: "#facc15", textTransform: "uppercase" }}>
                ⏳ Aguardando Aprovação
              </span>
              <span style={{ fontSize: "20px" }}>📥</span>
            </div>
            <div style={{ fontSize: "28px", fontWeight: "900", color: "#ffffff", letterSpacing: "-0.5px" }}>
              {pendentesComprovante.length}
            </div>
            <div style={{ fontSize: "11px", color: theme.subtext, marginTop: "4px" }}>
              Comprovantes aguardando conferência
            </div>
          </div>

          {/* Card 2: Aprovados Recentemente */}
          <div
            onClick={() => setFiltroFila("aprovados")}
            style={{
              background: filtroFila === "aprovados" ? "rgba(34, 197, 94, 0.15)" : theme.card2,
              border: `1.5px solid ${filtroFila === "aprovados" ? "#22c55e" : "rgba(34, 197, 94, 0.3)"}`,
              borderRadius: "16px",
              padding: "18px 20px",
              cursor: "pointer",
              transition: "all 0.18s ease",
              boxShadow: filtroFila === "aprovados" ? "0 8px 24px rgba(34, 197, 94, 0.2)" : "none",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontSize: "12px", fontWeight: "800", color: "#22c55e", textTransform: "uppercase" }}>
                ✓ Aprovados Recentemente
              </span>
              <span style={{ fontSize: "20px" }}>🟢</span>
            </div>
            <div style={{ fontSize: "28px", fontWeight: "900", color: "#ffffff", letterSpacing: "-0.5px" }}>
              {aprovadosRecentes.length}
            </div>
            <div style={{ fontSize: "11px", color: theme.subtext, marginTop: "4px" }}>
              Pagamentos já confirmados no ciclo
            </div>
          </div>

          {/* Card 3: Mecânicos Bloqueados */}
          <div
            onClick={() => setFiltroFila("bloqueados")}
            style={{
              background: filtroFila === "bloqueados" ? "rgba(239, 68, 68, 0.15)" : theme.card2,
              border: `1.5px solid ${filtroFila === "bloqueados" ? "#ef4444" : "rgba(239, 68, 68, 0.3)"}`,
              borderRadius: "16px",
              padding: "18px 20px",
              cursor: "pointer",
              transition: "all 0.18s ease",
              boxShadow: filtroFila === "bloqueados" ? "0 8px 24px rgba(239, 68, 68, 0.2)" : "none",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontSize: "12px", fontWeight: "800", color: "#ef4444", textTransform: "uppercase" }}>
                🚫 Acesso Bloqueado
              </span>
              <span style={{ fontSize: "20px" }}>🔒</span>
            </div>
            <div style={{ fontSize: "28px", fontWeight: "900", color: "#ffffff", letterSpacing: "-0.5px" }}>
              {mecanicosBloqueados.length}
            </div>
            <div style={{ fontSize: "11px", color: theme.subtext, marginTop: "4px" }}>
              Mecânicos com acesso restrito
            </div>
          </div>
        </div>

        {/* BARRA DE CONTROLE: FILTROS E BUSCA */}
        <div
          style={{
            ...styles.whiteCard,
            padding: "16px 20px",
            marginBottom: "18px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          {/* Botões de Filtro */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", color: theme.subtext, marginRight: "4px" }}>
              Filtro:
            </span>
            <button
              type="button"
              onClick={() => setFiltroFila("pendentes")}
              style={{
                background: filtroFila === "pendentes" ? "#facc15" : "rgba(255,255,255,0.06)",
                color: filtroFila === "pendentes" ? "#000" : theme.text,
                border: "1px solid rgba(250,204,21,0.4)",
                padding: "6px 14px",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "11px",
                fontWeight: "800",
              }}
            >
              🟡 Aguardando Confirmação ({pendentesComprovante.length})
            </button>
            <button
              type="button"
              onClick={() => setFiltroFila("aprovados")}
              style={{
                background: filtroFila === "aprovados" ? "#22c55e" : "rgba(255,255,255,0.06)",
                color: filtroFila === "aprovados" ? "#000" : theme.text,
                border: "1px solid rgba(34,197,94,0.4)",
                padding: "6px 14px",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "11px",
                fontWeight: "800",
              }}
            >
              🟢 Aprovados Recentemente ({aprovadosRecentes.length})
            </button>
            <button
              type="button"
              onClick={() => setFiltroFila("bloqueados")}
              style={{
                background: filtroFila === "bloqueados" ? "#ef4444" : "rgba(255,255,255,0.06)",
                color: filtroFila === "bloqueados" ? "#fff" : theme.text,
                border: "1px solid rgba(239,68,68,0.4)",
                padding: "6px 14px",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "11px",
                fontWeight: "800",
              }}
            >
              🚫 Mecânicos Bloqueados ({mecanicosBloqueados.length})
            </button>
            <button
              type="button"
              onClick={() => setFiltroFila("todos")}
              style={{
                background: filtroFila === "todos" ? theme.accent : "rgba(255,255,255,0.06)",
                color: filtroFila === "todos" ? "#000" : theme.text,
                border: `1px solid ${theme.border}`,
                padding: "6px 14px",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "11px",
                fontWeight: "800",
              }}
            >
              🔘 Todos ({pagamentosAtivos.length})
            </button>
          </div>

          {/* Campo de Busca */}
          <div style={{ position: "relative", minWidth: "260px", flex: 1, maxWidth: "380px" }}>
            <input
              type="text"
              placeholder="🔍 Buscar por nome ou ID..."
              value={buscaFila}
              onChange={(e) => setBuscaFila(e.target.value)}
              style={{
                width: "100%",
                background: "rgba(0,0,0,0.35)",
                border: `1px solid ${theme.border}`,
                borderRadius: "10px",
                padding: "8px 14px",
                color: "#fff",
                fontSize: "12px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            {buscaFila && (
              <button
                type="button"
                onClick={() => setBuscaFila("")}
                style={{
                  position: "absolute",
                  right: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  color: theme.subtext,
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: "bold",
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* TABELA DE FILA DE PAGAMENTOS */}
        <div style={styles.whiteCard}>
          <div style={{ ...styles.cardHeader, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <span style={{ ...styles.dot, background: filtroFila === "pendentes" ? "#facc15" : filtroFila === "aprovados" ? "#22c55e" : theme.accent }}></span>
              <span>
                {filtroFila === "pendentes"
                  ? "Aguardando Aprovação (Comprovantes)"
                  : filtroFila === "aprovados"
                  ? "Pagamentos Aprovados Recentemente"
                  : filtroFila === "bloqueados"
                  ? "Pagamentos de Mecânicos Bloqueados"
                  : "Todos os Registros de Pagamentos"}
              </span>
            </div>
            <span style={{ fontSize: "11px", color: theme.subtext }}>
              Exibindo <b style={{ color: "#fff" }}>{listaExibicao.length}</b> de {listaFiltrada.length}
            </span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: theme.card2, textAlign: "left" }}>
                  <th style={{ padding: "12px 14px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", textTransform: "uppercase", color: theme.subtext }}>
                    Data / Envio
                  </th>
                  <th style={{ padding: "12px 14px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", textTransform: "uppercase", color: theme.subtext }}>
                    Funcionário & Acesso
                  </th>
                  <th style={{ padding: "12px 14px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", textTransform: "uppercase", color: theme.subtext }}>
                    Período / Referência
                  </th>
                  <th style={{ padding: "12px 14px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", textTransform: "uppercase", color: theme.subtext }}>
                    Valor
                  </th>
                  <th style={{ padding: "12px 14px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", textTransform: "uppercase", color: theme.subtext }}>
                    Comprovante
                  </th>
                  <th style={{ padding: "12px 14px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", textTransform: "uppercase", color: theme.subtext }}>
                    Status Pagamento
                  </th>
                  <th style={{ padding: "12px 14px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", textTransform: "uppercase", color: theme.subtext, textAlign: "right" }}>
                    Ações Rápidas
                  </th>
                </tr>
              </thead>
              <tbody>
                {listaExibicao.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ padding: "48px 20px", textAlign: "center", color: theme.subtext }}>
                      <div style={{ fontSize: "32px", marginBottom: "10px" }}>📭</div>
                      <div style={{ fontSize: "15px", fontWeight: "700", color: "#fff" }}>
                        Nenhum registro encontrado
                      </div>
                      <div style={{ fontSize: "12px", marginTop: "4px" }}>
                        Não há pagamentos correspondentes ao filtro selecionado no momento.
                      </div>
                    </td>
                  </tr>
                ) : (
                  listaExibicao.map((pag) => {
                    const func = financasFuncionarios.find((f) => f.id === pag.funcionario_id);
                    const estaBloqueado = func?.bloqueado_financeiro;

                    return (
                      <tr
                        key={pag.id}
                        style={{
                          borderBottom: `1px solid ${theme.border}`,
                          background: !pag.confirmado ? "rgba(250,204,21,0.03)" : "transparent",
                          transition: "background 0.15s",
                        }}
                      >
                        {/* Data / Hora de Envio */}
                        <td style={{ padding: "12px 14px", color: theme.subtext, whiteSpace: "nowrap", fontSize: "11.5px" }}>
                          {formatarDataHora ? formatarDataHora(pag.criado_em) : (pag.criado_em || "—")}
                        </td>

                        {/* Funcionário, Cargo e Status de Acesso */}
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div style={{ fontWeight: "800", color: theme.text, fontSize: "13.5px" }}>
                              {pag.funcionario_nome}
                            </div>
                            <span style={{ fontSize: "11px", color: theme.subtext }}>
                              (ID: {pag.funcionario_id})
                            </span>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px", flexWrap: "wrap" }}>
                            {func && (
                              <span style={{ fontSize: "11px", color: theme.subtext }}>
                                {getLabelCargo ? getLabelCargo(func.role) : func.role}
                              </span>
                            )}
                            {estaBloqueado ? (
                              <span
                                style={{
                                  background: "rgba(239,68,68,0.15)",
                                  color: "#ef4444",
                                  border: "1px solid rgba(239,68,68,0.35)",
                                  padding: "1px 7px",
                                  borderRadius: "6px",
                                  fontSize: "10px",
                                  fontWeight: "800",
                                }}
                              >
                                🚫 Acesso Bloqueado
                              </span>
                            ) : (
                              <span
                                style={{
                                  background: "rgba(34,197,94,0.15)",
                                  color: "#22c55e",
                                  border: "1px solid rgba(34,197,94,0.35)",
                                  padding: "1px 7px",
                                  borderRadius: "6px",
                                  fontSize: "10px",
                                  fontWeight: "800",
                                }}
                              >
                                🔓 Acesso Liberado
                              </span>
                            )}
                            {func?.data_vencimento && (
                              <span style={{ fontSize: "10.5px", color: theme.subtext }}>
                                • Venc: <b style={{ color: "#fff" }}>{formatarData(func.data_vencimento)}</b>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Período */}
                        <td style={{ padding: "12px 14px", color: theme.subtext, fontSize: "12px" }}>
                          {(pag.observacao || "").replace("Cobrança automática - ", "") || "—"}
                        </td>

                        {/* Valor */}
                        <td style={{ padding: "12px 14px", color: "#facc15", fontWeight: "900", fontSize: "14px", whiteSpace: "nowrap" }}>
                          ${Number(pag.valor || 0).toLocaleString("pt-BR")}
                        </td>

                        {/* Comprovante */}
                        <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                          {pag.comprovante_link ? (
                            <a
                              href={pag.comprovante_link}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                background: "rgba(56,189,248,0.12)",
                                color: "#38bdf8",
                                border: "1px solid rgba(56,189,248,0.35)",
                                padding: "6px 12px",
                                borderRadius: "8px",
                                fontSize: "11px",
                                fontWeight: "800",
                                textDecoration: "none",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                                transition: "all 0.15s",
                              }}
                            >
                              🔗 Ver Comprovante
                            </a>
                          ) : (
                            <span style={{ color: theme.subtext, fontSize: "11px" }}>Sem anexo</span>
                          )}
                        </td>

                        {/* Status Pagamento */}
                        <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                          {pag.confirmado ? (
                            <div>
                              <span style={{ color: "#22c55e", fontWeight: "800", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                ✓ Aprovado
                              </span>
                              {pag.confirmado_em && (
                                <div style={{ fontSize: "10px", color: theme.subtext }}>
                                  {formatarDataHora ? formatarDataHora(pag.confirmado_em) : pag.confirmado_em}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: "#facc15", fontWeight: "800", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                              ⏳ Pendente
                            </span>
                          )}
                        </td>

                        {/* Ações Rápidas */}
                        <td style={{ padding: "12px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                          <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", alignItems: "center" }}>
                            {/* Botão APROVAR (se pendente) */}
                            {!pag.confirmado && (
                              <button
                                type="button"
                                onClick={() => {
                                  let dataDom = null;
                                  if (pag.observacao?.includes("até ")) {
                                    const partes = pag.observacao.split("até ");
                                    if (partes[1]) {
                                      const dataBR = partes[1].split("]")[0].trim();
                                      if (dataBR.includes("/")) {
                                        const [d, m] = dataBR.split("/");
                                        const ano = new Date().getFullYear();
                                        dataDom = `${ano}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
                                      }
                                    }
                                  }

                                  abrirDialogo({
                                    tipo: "confirmacao",
                                    titulo: "Confirmar Aprovação de Pagamento",
                                    mensagem: `Confirmação de Pagamento Individual:\n\n👤 Funcionário: ${pag.funcionario_nome} (ID: ${pag.funcionario_id})\n💰 Valor: $${Number(pag.valor).toLocaleString("pt-BR")}\n📅 Período: ${(pag.observacao || "").replace("Cobrança automática - ", "") || "Semana Atual"}\n📎 Comprovante: Anexado para conferência\n\nO que será realizado:\n• Pagamento marcado como APROVADO\n• Acesso do funcionário DESBLOQUEADO imediatamente\n• Vencimento estendido para o próximo ciclo\n• Apenas este funcionário será alterado`,
                                    textoConfirmar: "Sim, Aprovar Pagamento",
                                    textoCancelar: "Cancelar",
                                    onConfirmar: () => {
                                      confirmarPagamentoSemanal(
                                        pag.id,
                                        pag.funcionario_id,
                                        pag.funcionario_nome,
                                        pag.comprovante_link,
                                        dataDom
                                      );
                                    },
                                  });
                                }}
                                style={{
                                  background: "linear-gradient(135deg, #15803d 0%, #16a34a 100%)",
                                  color: "#fff",
                                  border: "none",
                                  padding: "7px 14px",
                                  borderRadius: "8px",
                                  cursor: "pointer",
                                  fontWeight: "800",
                                  fontSize: "11px",
                                  boxShadow: "0 4px 10px rgba(34,197,94,0.25)",
                                }}
                              >
                                ✓ APROVAR
                              </button>
                            )}

                            {/* Botão REABRIR (se aprovado, para desfazer liberação indevida) */}
                            {pag.confirmado && reabrirPagamento && (
                              <button
                                type="button"
                                onClick={() => {
                                  abrirDialogo({
                                    tipo: "aviso",
                                    titulo: "Reabrir Pagamento (Marcar Pendente)",
                                    mensagem: `Deseja desmarcar a confirmação deste pagamento de ${pag.funcionario_nome}?\n\nEle voltará para o status de 'Pendente' para que você possa reavaliar o comprovante.`,
                                    textoConfirmar: "Sim, Marcar Pendente",
                                    textoCancelar: "Cancelar",
                                    onConfirmar: () => reabrirPagamento(pag.id, pag.funcionario_nome),
                                  });
                                }}
                                style={{
                                  background: "rgba(245,158,11,0.12)",
                                  color: "#f59e0b",
                                  border: "1px solid rgba(245,158,11,0.35)",
                                  padding: "6px 10px",
                                  borderRadius: "8px",
                                  cursor: "pointer",
                                  fontWeight: "800",
                                  fontSize: "11px",
                                }}
                                title="Desmarcar confirmação e reabrir como pendente"
                              >
                                ↺ Reabrir
                              </button>
                            )}

                            {/* Botão Liberar / Bloquear Acesso do Funcionário */}
                            {func && (
                              estaBloqueado ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const hoje = new Date();
                                    const diasAteDom = 7 - hoje.getDay();
                                    const proxDom = new Date(hoje);
                                    proxDom.setDate(hoje.getDate() + (diasAteDom === 0 ? 7 : diasAteDom));
                                    const proxDomStr = proxDom.toLocaleDateString("pt-BR");

                                    abrirDialogo({
                                      tipo: "confirmacao",
                                      titulo: "Confirmar Liberação de Acesso",
                                      mensagem: `Confirmação de Liberação Individual:\n\n👤 Funcionário: ${func.nome} (ID: ${func.id})\n📅 Vencimento Atual: ${func.data_vencimento ? formatarData(func.data_vencimento) : "Pendente"}\n\nO que será realizado:\n• Acesso ao sistema DESBLOQUEADO imediatamente\n• Vencimento estendido para o próximo domingo (${proxDomStr})\n• Crédito de 24h restaurado\n• Apenas este funcionário será liberado`,
                                      textoConfirmar: "Sim, Liberar Acesso",
                                      textoCancelar: "Cancelar",
                                      onConfirmar: () => desbloquearFuncionario(func.id, func.nome),
                                    });
                                  }}
                                  style={{
                                    background: "rgba(34,197,94,0.15)",
                                    color: "#22c55e",
                                    border: "1px solid #22c55e",
                                    padding: "6px 10px",
                                    borderRadius: "8px",
                                    cursor: "pointer",
                                    fontWeight: "800",
                                    fontSize: "11px",
                                  }}
                                  title="Desbloquear acesso de funcionário"
                                >
                                  🔓 Liberar
                                </button>
                              ) : (
                                bloquearFuncionario && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      abrirDialogo({
                                        tipo: "perigo",
                                        titulo: "Bloquear Acesso Financeiro",
                                        mensagem: `Deseja realmente BLOQUEAR o acesso de ${func.nome} (ID: ${func.id})?\n\nO funcionário ficará impedido de utilizar o sistema até que regularize o pagamento.`,
                                        textoConfirmar: "Sim, Bloquear",
                                        textoCancelar: "Cancelar",
                                        onConfirmar: () => bloquearFuncionario(func.id, func.nome),
                                      });
                                    }}
                                    style={{
                                      background: "rgba(239,68,68,0.1)",
                                      color: "#ef4444",
                                      border: "1px solid rgba(239,68,68,0.25)",
                                      padding: "6px 10px",
                                      borderRadius: "8px",
                                      cursor: "pointer",
                                      fontWeight: "800",
                                      fontSize: "11px",
                                    }}
                                    title="Bloquear acesso financeiro deste mecânico"
                                  >
                                    🚫 Bloquear
                                  </button>
                                )
                              )
                            )}

                            {/* Botão Dossiê */}
                            {func && (
                              <button
                                type="button"
                                onClick={() => setFuncSelecionado(func)}
                                style={{
                                  background: "rgba(255,255,255,0.06)",
                                  color: "#fff",
                                  border: `1px solid ${theme.border}`,
                                  padding: "6px 10px",
                                  borderRadius: "8px",
                                  cursor: "pointer",
                                  fontSize: "11px",
                                  fontWeight: "700",
                                }}
                                title="Abrir Dossiê deste mecânico"
                              >
                                📜 Dossiê
                              </button>
                            )}

                            {/* Botão Apagar / Recusar */}
                            <button
                              type="button"
                              onClick={() => {
                                abrirDialogo({
                                  tipo: "perigo",
                                  titulo: "Recusar / Apagar Pagamento",
                                  mensagem: `Deseja recusar ou apagar este registro de pagamento de ${pag.funcionario_nome}?`,
                                  textoConfirmar: "Sim, Apagar",
                                  onConfirmar: () => apagarPagamento(pag.id),
                                });
                              }}
                              style={{
                                background: "rgba(239,68,68,0.08)",
                                color: "#ef4444",
                                border: "1px solid rgba(239,68,68,0.2)",
                                padding: "6px 8px",
                                borderRadius: "8px",
                                cursor: "pointer",
                                fontSize: "11px",
                              }}
                              title="Recusar / Apagar registro"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={styles.dashContainer}>
      <style>{`
        @keyframes fadeLogin {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <AppModalNotificacao />
      <AppHeaderBar />

      {/* DIÁLOGO MODERNO LOCAL */}
      {dialogConfig && (
        <ModalConfirmacaoDialog
          isOpen={Boolean(dialogConfig)}
          tipo={dialogConfig.tipo}
          titulo={dialogConfig.titulo}
          mensagem={dialogConfig.mensagem}
          textoConfirmar={dialogConfig.textoConfirmar}
          textoCancelar={dialogConfig.textoCancelar}
          onConfirmar={dialogConfig.onConfirmar}
          onCancelar={dialogConfig.onCancelar}
          valorInputPadrao={dialogConfig.valorInputPadrao}
          placeholderInput={dialogConfig.placeholderInput}
          isDarkMode={true}
          theme={theme}
        />
      )}

      {renderModalHistorico()}
      {renderModalContratacoesSemCobranca()}

      <div style={{ padding: "26px 24px 60px", maxWidth: "1320px", margin: "0 auto", animation: "fadeLogin 0.3s ease" }}>
        {/* CABEÇALHO DA PÁGINA */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "22px", flexWrap: "wrap", gap: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {setPaginaAtual && (
              <button
                type="button"
                onClick={() => setPaginaAtual("dashboard")}
                style={{
                  background: theme.card2 || "rgba(255,255,255,0.06)",
                  border: `1px solid ${theme.border}`,
                  color: theme.text,
                  padding: "8px 14px",
                  borderRadius: "10px",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: "700",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "background 0.2s",
                }}
              >
                ← Voltar
              </button>
            )}
            <div>
              <h2 style={{ color: theme.text, margin: 0, fontWeight: "800", fontSize: "20px" }}>
                💰 Gestão Financeira — Donos & Administração
              </h2>
              <p style={{ margin: "2px 0 0", fontSize: "12px", color: theme.subtext }}>
                Controle de taxas semanais, quem pagou, quem falta e aprovação de comprovantes (Marco Zero: 12/10)
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>

            <button
              type="button"
              onClick={() => setModalContratacoesSemCobranca(true)}
              style={{
                background: "rgba(245,158,11,0.12)",
                border: "1px solid rgba(245,158,11,0.35)",
                color: "#f59e0b",
                padding: "9px 16px",
                borderRadius: "10px",
                cursor: "pointer",
                fontWeight: "800",
                fontSize: "12px",
              }}
            >
              🔍 Verificar Contratações
            </button>

            <button
              type="button"
              onClick={() => {
                buscarFinancas();
                buscarPagamentosSemanais();
              }}
              style={{
                background: "rgba(255,255,255,0.06)",
                border: `1px solid ${theme.border}`,
                color: theme.text,
                padding: "9px 16px",
                borderRadius: "10px",
                cursor: "pointer",
                fontWeight: "800",
                fontSize: "12px",
              }}
            >
              🔄 Atualizar
            </button>
          </div>
        </div>

        {/* SUB-ABAS DE NAVEGAÇÃO */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "22px", background: "rgba(0,0,0,0.35)", padding: "5px", borderRadius: "12px", width: "fit-content", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setSubAba("geral")}
            style={{
              background: subAba === "geral" ? theme.accent : "transparent",
              color: subAba === "geral" ? "#000" : theme.subtext,
              border: "none",
              padding: "9px 20px",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "800",
              fontSize: "12px",
              transition: "all 0.2s",
            }}
          >
            📊 Visão Geral dos Mecânicos
          </button>

          <button
            type="button"
            onClick={() => setSubAba("devedores")}
            style={{
              background: subAba === "devedores" ? "#ef4444" : "transparent",
              color: subAba === "devedores" ? "#fff" : theme.subtext,
              border: "none",
              padding: "9px 20px",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "800",
              fontSize: "12px",
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              gap: "7px",
            }}
          >
            ⚠️ Resumo de Atrasos
            {qtdPendentesComprovante > 0 && (
              <span
                style={{
                  background: subAba === "devedores" ? "#000" : "#facc15",
                  color: subAba === "devedores" ? "#fff" : "#000",
                  fontSize: "10px",
                  fontWeight: "900",
                  padding: "1px 7px",
                  borderRadius: "10px",
                }}
              >
                {qtdPendentesComprovante}
              </span>
            )}
          </button>
        </div>

        {subAba === "geral" ? (
          <>
            {/* Banner de alerta no topo se houver comprovantes pendentes */}
            {qtdPendentesComprovante > 0 && (
              <div
                style={{
                  background: "linear-gradient(135deg, rgba(234,179,8,0.15) 0%, rgba(202,138,4,0.08) 100%)",
                  border: "1px solid rgba(250,204,21,0.4)",
                  borderRadius: "14px",
                  padding: "14px 20px",
                  marginBottom: "20px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "12px",
                  animation: "fadeLogin 0.25s ease-out",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ fontSize: "24px" }}>📥</div>
                  <div>
                    <div style={{ color: "#facc15", fontWeight: "800", fontSize: "14px" }}>
                      Existem {qtdPendentesComprovante} comprovante(s) aguardando sua aprovação!
                    </div>
                    <div style={{ color: theme.subtext, fontSize: "12px" }}>
                      Mecânicos enviaram novos comprovantes para quitação da taxa semanal.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSubAba("devedores")}
                  style={{
                    background: "linear-gradient(135deg, #eab308 0%, #ca8a04 100%)",
                    color: "#000",
                    border: "none",
                    padding: "8px 18px",
                    borderRadius: "9px",
                    cursor: "pointer",
                    fontWeight: "900",
                    fontSize: "12px",
                    boxShadow: "0 4px 14px rgba(234,179,8,0.3)",
                  }}
                >
                  ⚡ Ver Resumo & Comprovantes
                </button>
              </div>
            )}

            {financasCarregando && (
              <div style={{ textAlign: "center", padding: "14px", color: theme.subtext, fontSize: "13px" }}>
                ⏳ Verificando status financeiro dos funcionários...
              </div>
            )}

            {/* TABELA PRINCIPAL DE FUNCIONÁRIOS */}
            <div style={styles.whiteCard}>
              <div style={{ ...styles.cardHeader, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span style={styles.dot}></span> Controle de Taxas por Funcionário
                </div>
                <span style={{ fontSize: "11px", color: theme.subtext }}>
                  Total: <b style={{ color: "#fff" }}>{funcsAtivos.length}</b> ativos
                </span>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ background: theme.card2, textAlign: "left" }}>
                      <th style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", textTransform: "uppercase", color: theme.subtext }}>
                        Funcionário
                      </th>
                      <th style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", textTransform: "uppercase", color: theme.subtext }}>
                        Cargo
                      </th>
                      <th style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", textTransform: "uppercase", color: theme.subtext }}>
                        Valor Semanal
                      </th>
                      <th style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", textTransform: "uppercase", color: theme.subtext }}>
                        Vencimento
                      </th>
                      <th style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", textTransform: "uppercase", color: theme.subtext }}>
                        Renovação
                      </th>
                      <th style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", textTransform: "uppercase", color: theme.subtext }}>
                        Status
                      </th>
                      <th style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", textTransform: "uppercase", color: theme.subtext }}>
                        Crédito 24h
                      </th>
                      <th style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", textTransform: "uppercase", color: theme.subtext, textAlign: "right" }}>
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...funcsAtivos]
                      .sort((a, b) => (a.nome || "").localeCompare(b.nome || ""))
                      .map((func) => {
                        const vencido = func.data_vencimento && func.data_vencimento < hoje;
                        const isIsento = !func.valor_semanal || func.valor_semanal === 0;
                        const statusColor = func.bloqueado_financeiro
                          ? "#ef4444"
                          : isIsento
                          ? theme.subtext
                          : vencido
                          ? "#f97316"
                          : "#22c55e";
                        const statusLabel = func.bloqueado_financeiro
                          ? "🔒 Bloqueado"
                          : isIsento
                          ? "⚪ Isento"
                          : vencido
                          ? "⚠️ Vencido"
                          : "✅ Em dia";
                        const estandoEditando = editandoFinancaId === func.id;

                        return (
                          <tr
                            key={func.id}
                            style={{
                              borderBottom: `1px solid ${theme.border}`,
                              background: func.bloqueado_financeiro ? "rgba(239,68,68,0.06)" : "transparent",
                            }}
                          >
                            <td style={{ padding: "12px", color: theme.text }}>
                              <button
                                type="button"
                                onClick={() => setFuncSelecionado(func)}
                                style={{
                                  background: "none",
                                  border: "none",
                                  color: theme.text,
                                  fontWeight: "700",
                                  cursor: "pointer",
                                  padding: 0,
                                  textAlign: "left",
                                  fontSize: "13.5px",
                                }}
                              >
                                {func.nome}
                              </button>
                              <div style={{ fontSize: "11px", color: theme.subtext }}>ID: {func.id}</div>
                            </td>

                            <td style={{ padding: "12px", fontSize: "12px", color: "#f97316", fontWeight: "600" }}>
                              {getLabelCargo(func.role)}
                            </td>

                            {estandoEditando ? (
                              <>
                                <td style={{ padding: "12px" }}>
                                  <input
                                    style={{ ...styles.input, width: "110px", padding: "6px 10px", fontSize: "12px" }}
                                    placeholder="Ex: 100000"
                                    value={editFinancaValor}
                                    onChange={(e) => setEditFinancaValor(e.target.value.replace(/\D/g, ""))}
                                  />
                                </td>
                                <td style={{ padding: "12px" }}>
                                  <input
                                    type="date"
                                    style={{ ...styles.input, width: "145px", padding: "6px 10px", fontSize: "12px" }}
                                    value={editFinancaVencimento}
                                    onChange={(e) => setEditFinancaVencimento(e.target.value)}
                                  />
                                </td>
                                <td style={{ padding: "12px" }}>
                                  <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "11px", color: theme.text }}>
                                    <input
                                      type="checkbox"
                                      checked={editFinancaRenovacao}
                                      onChange={(e) => setEditFinancaRenovacao(e.target.checked)}
                                    />
                                    +7 dias
                                  </label>
                                </td>
                                <td colSpan={3} style={{ padding: "12px" }}>
                                  <div style={{ display: "flex", gap: "6px" }}>
                                    <button
                                      type="button"
                                      onClick={() => salvarFinancaFuncionario(func.id)}
                                      style={{
                                        background: "#16a34a",
                                        color: "#fff",
                                        border: "none",
                                        padding: "6px 12px",
                                        borderRadius: "7px",
                                        cursor: "pointer",
                                        fontSize: "11px",
                                        fontWeight: "800",
                                      }}
                                    >
                                      ✓ Salvar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => sugerirCobrancaPadraoInline(func)}
                                      style={{
                                        background: "rgba(250,204,21,0.12)",
                                        border: "1px solid #eab308",
                                        color: "#facc15",
                                        padding: "6px 10px",
                                        borderRadius: "7px",
                                        cursor: "pointer",
                                        fontSize: "11px",
                                        fontWeight: "700",
                                      }}
                                    >
                                      Sugerir $100k
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditandoFinancaId(null)}
                                      style={{
                                        background: "#333",
                                        color: "#fff",
                                        border: "none",
                                        padding: "6px 10px",
                                        borderRadius: "7px",
                                        cursor: "pointer",
                                        fontSize: "11px",
                                      }}
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                <td style={{ padding: "12px", color: "#facc15", fontWeight: "800" }}>
                                  {func.valor_semanal > 0 ? (
                                    `$${Number(func.valor_semanal).toLocaleString("pt-BR")}`
                                  ) : (
                                    <span style={{ color: theme.subtext }}>—</span>
                                  )}
                                </td>

                                <td style={{ padding: "12px", color: vencido ? "#ef4444" : theme.text, fontWeight: vencido ? "800" : "500" }}>
                                  {func.data_vencimento ? formatarData(func.data_vencimento) : <span style={{ color: theme.subtext }}>—</span>}
                                </td>

                                <td style={{ padding: "12px" }}>
                                  {func.renovacao_auto ? (
                                    <span style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", padding: "3px 8px", borderRadius: "10px", fontSize: "11px", fontWeight: "700" }}>
                                      ✓ Ativado
                                    </span>
                                  ) : (
                                    <span style={{ color: theme.subtext, fontSize: "11px" }}>Desativado</span>
                                  )}
                                </td>

                                <td style={{ padding: "12px" }}>
                                  <span
                                    style={{
                                      background: `${statusColor}18`,
                                      color: statusColor,
                                      border: `1px solid ${statusColor}35`,
                                      padding: "3px 10px",
                                      borderRadius: "8px",
                                      fontSize: "11px",
                                      fontWeight: "800",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {statusLabel}
                                  </span>
                                </td>

                                <td style={{ padding: "12px" }}>
                                  {func.credito_24h_disponivel ? (
                                    <span style={{ color: "#fbbf24", fontSize: "11px", fontWeight: "700" }}>⚡ Disponível</span>
                                  ) : (
                                    <span style={{ color: theme.subtext, fontSize: "11px" }}>Usado</span>
                                  )}
                                </td>

                                <td style={{ padding: "12px", textAlign: "right" }}>
                                  <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                                    <button
                                      type="button"
                                      onClick={() => iniciarEdicaoFinanca(func)}
                                      style={{
                                        background: "rgba(56,189,248,0.1)",
                                        color: "#38bdf8",
                                        border: "1px solid rgba(56,189,248,0.3)",
                                        padding: "5px 10px",
                                        borderRadius: "7px",
                                        cursor: "pointer",
                                        fontSize: "11px",
                                        fontWeight: "700",
                                      }}
                                    >
                                      ✏️ Config
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setFuncSelecionado(func)}
                                      style={{
                                        background: "rgba(255,255,255,0.06)",
                                        color: "#fff",
                                        border: `1px solid ${theme.border}`,
                                        padding: "5px 12px",
                                        borderRadius: "7px",
                                        cursor: "pointer",
                                        fontSize: "11px",
                                        fontWeight: "700",
                                      }}
                                    >
                                      📜 Dossiê
                                    </button>
                                    {func.bloqueado_financeiro && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const hoje = new Date();
                                          const diasAteDom = 7 - hoje.getDay();
                                          const proxDom = new Date(hoje);
                                          proxDom.setDate(hoje.getDate() + (diasAteDom === 0 ? 7 : diasAteDom));
                                          const proxDomStr = proxDom.toLocaleDateString("pt-BR");

                                          abrirDialogo({
                                            tipo: "confirmacao",
                                            titulo: "Confirmar Liberação de Acesso",
                                            mensagem: `Confirmação de Liberação Individual:\n\n👤 Funcionário: ${func.nome} (ID: ${func.id})\n💼 Cargo: ${getLabelCargo ? getLabelCargo(func.role) : (func.role || "Mecânico")}\n📅 Vencimento Atual: ${func.data_vencimento ? formatarData(func.data_vencimento) : "Pendente/Sem data"}\n💰 Taxa Semanal: $${Number(func.valor_semanal || 0).toLocaleString("pt-BR")}\n\nO que será realizado:\n• Desbloqueio imediato do acesso de ${func.nome}\n• Vencimento estendido para o próximo domingo (${proxDomStr})\n• Crédito de 24h restaurado\n• Apenas este funcionário será liberado (nenhum outro será modificado)`,
                                            textoConfirmar: "Sim, Liberar Acesso",
                                            textoCancelar: "Cancelar",
                                            onConfirmar: () => desbloquearFuncionario(func.id, func.nome),
                                          });
                                        }}
                                        style={{
                                          background: "rgba(34,197,94,0.15)",
                                          color: "#22c55e",
                                          border: "1px solid #22c55e",
                                          padding: "5px 10px",
                                          borderRadius: "7px",
                                          cursor: "pointer",
                                          fontSize: "11px",
                                          fontWeight: "800",
                                        }}
                                      >
                                        🔓 Liberar
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* COMPROVANTES AGUARDANDO CONFIRMAÇÃO */}
            {pagamentosAtivos.filter((p) => !p.confirmado && p.comprovante_link).length > 0 && (
              <div style={{ ...styles.whiteCard, marginTop: "24px", border: "1px solid rgba(250,204,21,0.35)" }}>
                <div style={styles.cardHeader}>
                  <span style={{ ...styles.dot, background: "#facc15" }}></span>
                  <span style={{ color: "#facc15" }}>Aguardando Confirmação (Comprovantes Enviados pela Equipe)</span>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                    <thead>
                      <tr style={{ background: theme.card2, textAlign: "left" }}>
                        <th style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", textTransform: "uppercase", color: theme.subtext }}>
                          Funcionário
                        </th>
                        <th style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", textTransform: "uppercase", color: theme.subtext }}>
                          Período / Obs
                        </th>
                        <th style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", textTransform: "uppercase", color: theme.subtext }}>
                          Valor
                        </th>
                        <th style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", textTransform: "uppercase", color: theme.subtext }}>
                          Comprovante
                        </th>
                        <th style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", textTransform: "uppercase", color: theme.subtext, textAlign: "right" }}>
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagamentosAtivos
                        .filter((p) => !p.confirmado && p.comprovante_link)
                        .map((pag) => (
                          <tr key={pag.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                            <td style={{ padding: "12px", color: theme.text }}>
                              <div style={{ fontWeight: "800" }}>{pag.funcionario_nome}</div>
                              <div style={{ fontSize: "10px", color: theme.subtext }}>ID: {pag.funcionario_id}</div>
                            </td>
                            <td style={{ padding: "12px", color: theme.subtext }}>
                              {(pag.observacao || "").replace("Cobrança automática - ", "") || "—"}
                            </td>
                            <td style={{ padding: "12px", color: "#facc15", fontWeight: "800" }}>
                              ${Number(pag.valor).toLocaleString("pt-BR")}
                            </td>
                            <td style={{ padding: "12px" }}>
                              <a
                                href={pag.comprovante_link}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  background: "rgba(56,189,248,0.12)",
                                  color: "#38bdf8",
                                  border: "1px solid rgba(56,189,248,0.3)",
                                  padding: "6px 12px",
                                  borderRadius: "8px",
                                  fontSize: "11px",
                                  fontWeight: "800",
                                  textDecoration: "none",
                                  display: "inline-block",
                                }}
                              >
                                🔗 Ver Comprovante
                              </a>
                            </td>
                            <td style={{ padding: "12px", textAlign: "right" }}>
                              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    let dataDom = null;
                                    if (pag.observacao?.includes("até ")) {
                                      const partes = pag.observacao.split("até ");
                                      if (partes[1]) {
                                        const dataBR = partes[1].split("]")[0].trim();
                                        if (dataBR.includes("/")) {
                                          const [d, m] = dataBR.split("/");
                                          const ano = new Date().getFullYear();
                                          dataDom = `${ano}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
                                        }
                                      }
                                    }

                                    abrirDialogo({
                                      tipo: "confirmacao",
                                      titulo: "Confirmar Aprovação de Pagamento",
                                      mensagem: `Confirmação de Pagamento:\n\n👤 Funcionário: ${pag.funcionario_nome} (ID: ${pag.funcionario_id})\n💰 Valor: $${Number(pag.valor).toLocaleString("pt-BR")}\n📅 Período: ${(pag.observacao || "").replace("Cobrança automática - ", "") || "Semana Atual"}\n📎 Comprovante: Anexado para conferência\n\nO que será realizado:\n• O pagamento desta semana será marcado como APROVADO\n• O funcionário será DESBLOQUEADO caso esteja bloqueado\n• O vencimento será estendido para o próximo ciclo\n• Apenas este pagamento de ${pag.funcionario_nome} será processado`,
                                      textoConfirmar: "Sim, Aprovar Pagamento",
                                      textoCancelar: "Cancelar",
                                      onConfirmar: () => {
                                        confirmarPagamentoSemanal(
                                          pag.id,
                                          pag.funcionario_id,
                                          pag.funcionario_nome,
                                          pag.comprovante_link,
                                          dataDom
                                        );
                                      },
                                    });
                                  }}
                                  style={{
                                    background: "linear-gradient(135deg, #15803d 0%, #16a34a 100%)",
                                    color: "#fff",
                                    border: "none",
                                    padding: "8px 16px",
                                    borderRadius: "8px",
                                    cursor: "pointer",
                                    fontWeight: "800",
                                    fontSize: "11px",
                                    boxShadow: "0 4px 10px rgba(34,197,94,0.25)",
                                  }}
                                >
                                  ✓ APROVAR
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    abrirDialogo({
                                      tipo: "perigo",
                                      titulo: "Recusar Comprovante",
                                      mensagem: `Deseja recusar ou apagar este comprovante de ${pag.funcionario_nome}?`,
                                      textoConfirmar: "Sim, Recusar",
                                      onConfirmar: () => apagarPagamento(pag.id),
                                    });
                                  }}
                                  style={{
                                    background: "rgba(239,68,68,0.1)",
                                    color: "#ef4444",
                                    border: `1px solid rgba(239,68,68,0.3)`,
                                    padding: "8px 10px",
                                    borderRadius: "8px",
                                    cursor: "pointer",
                                    fontSize: "11px",
                                  }}
                                  title="Recusar / Apagar"
                                >
                                  🗑️
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : (
          renderResumoAtrasos()
        )}
      </div>
    </div>
  );
}
