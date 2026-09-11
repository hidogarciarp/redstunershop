"use client";
import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../utils/supabaseClient";
import { analisarServicoTunagem, formatarReciboDiscord, ITENS_BANCADA_OPCOES, CATALOGO_PECAS_ESTETICAS } from "../utils/calculadoraTunagem";
import { isAdminOuDono } from "../utils/helpers";

// Helper para converter base64 DataURL em Blob para envio multipart/form-data ao Discord
function dataURLtoBlob(dataurl) {
  try {
    const arr = dataurl.split(",");
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  } catch (err) {
    console.error("Erro ao converter dataURL para Blob:", err);
    return null;
  }
}

export default function ModalDetalheTunagem({
  theme,
  modalLogDetalhe,
  setModalLogDetalhe,
  usuarioLogado,
  podeVerJsonBruto = false,
  onConcluido
}) {
  const [abaModalDetalhe, setAbaModalDetalhe] = useState("extrato"); // 'extrato' | 'json'
  const [fotoRegistro, setFotoRegistro] = useState("");
  const [salvandoCobranca, setSalvandoCobranca] = useState(false);
  const [desbloqueando, setDesbloqueando] = useState(false);
  const [modoLink, setModoLink] = useState(false);
  const [inputLinkFoto, setInputLinkFoto] = useState("");
  const [salvandoFotoAvulsa, setSalvandoFotoAvulsa] = useState(false);
  const [itensSelecionados, setItensSelecionados] = useState([]);
  const [itensEsteticosManuais, setItensEsteticosManuais] = useState([]);
  const [modalSeletorEstetico, setModalSeletorEstetico] = useState(false);
  const [buscaEstetica, setBuscaEstetica] = useState("");
  const [secaoEsteticaFiltro, setSecaoEsteticaFiltro] = useState("Todas");

  const isDonoAdmin = Boolean(
    podeVerJsonBruto ||
    usuarioLogado?.role === "dono" ||
    usuarioLogado?.role === "admin" ||
    (typeof isAdminOuDono === "function" && isAdminOuDono(usuarioLogado?.role))
  );
  
  // Itens manuais de bancada / inventário (Nitro, Kit Drift, etc.)
  const [adicionaisBancada, setAdicionaisBancada] = useState([]);
  const [modalCustomAdicional, setModalCustomAdicional] = useState(false);
  const [customNome, setCustomNome] = useState("");
  const [customValor, setCustomValor] = useState("");

  // Análise dos dados de modificações
  const analiseModal = React.useMemo(() => {
    if (!modalLogDetalhe) return { itensCobrados: [], totalACobrar: 0, quantidadeItens: 0 };
    return analisarServicoTunagem(modalLogDetalhe.antes_json || {}, modalLogDetalhe.depois_json || {}, modalLogDetalhe.valor_pago || 0);
  }, [modalLogDetalhe]);

  // Peças filtradas para exibição no modal de seleção estética
  const pecasFiltradas = React.useMemo(() => {
    return (CATALOGO_PECAS_ESTETICAS || []).filter((p) => {
      const termo = buscaEstetica.toLowerCase().trim();
      const matchBusca = !termo ||
        p.nome.toLowerCase().includes(termo) ||
        (p.categoria && p.categoria.toLowerCase().includes(termo)) ||
        (p.secao && p.secao.toLowerCase().includes(termo));
      const matchSecao = secaoEsteticaFiltro === "Todas" || p.secao === secaoEsteticaFiltro;
      return matchBusca && matchSecao;
    });
  }, [buscaEstetica, secaoEsteticaFiltro]);

  // Lista de itens a exibir (candidatos detectados se fallback, ou itens do diff + peças adicionadas manualmente)
  const listaExibicaoBase = analiseModal.isFallbackPainel && analiseModal.candidatosDisponiveis?.length > 0
    ? analiseModal.candidatosDisponiveis
    : analiseModal.itensCobrados;

  const listaExibicao = [...listaExibicaoBase, ...itensEsteticosManuais];

  const logUuidAtual = modalLogDetalhe
    ? (modalLogDetalhe.uuid || modalLogDetalhe.id || modalLogDetalhe.created_at || modalLogDetalhe.data_hora || modalLogDetalhe)
    : null;
  const ultimoLogUuidRef = useRef(null);

  // Ao abrir ou alterar para um log diferente, carrega a foto existente e seleciona os itens padrão
  useEffect(() => {
    if (!modalLogDetalhe) {
      ultimoLogUuidRef.current = null;
      setFotoRegistro("");
      setItensSelecionados([]);
      setAdicionaisBancada([]);
      setItensEsteticosManuais([]);
      setModalSeletorEstetico(false);
      setBuscaEstetica("");
      return;
    }

    // Se já estamos com o modal aberto para ESTE MESMO log, NÃO reseta o estado (evita perder foto colada ao re-renderizar)
    if (ultimoLogUuidRef.current === logUuidAtual) {
      return;
    }

    ultimoLogUuidRef.current = logUuidAtual;
    setFotoRegistro(modalLogDetalhe.foto_url || modalLogDetalhe.comprovante_url || "");
    setAbaModalDetalhe("extrato");
    setItensSelecionados((analiseModal.itensCobrados || []).map((i) => i.id));
    setAdicionaisBancada([]);
    setItensEsteticosManuais([]);
    setModalSeletorEstetico(false);
    setBuscaEstetica("");
  }, [logUuidAtual, modalLogDetalhe, analiseModal]);

  // Listener global de Ctrl + V para colar imagem
  useEffect(() => {
    const handlePaste = (e) => {
      if (!modalLogDetalhe) return;
      const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type && item.type.indexOf("image") !== -1) {
          const file = item.getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
              if (event.target?.result) {
                setFotoRegistro(event.target.result);
              }
            };
            reader.readAsDataURL(file);
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [logUuidAtual]);

  if (!modalLogDetalhe) return null;

  const custoPainel = Number(modalLogDetalhe.valor_pago || 0);

  // Toggle inteligente com trava de orçamento e substituição automática
  const toggleItem = (item) => {
    const isMarcado = itensSelecionados.includes(item.id);
    if (isMarcado) {
      setItensSelecionados((prev) => prev.filter((id) => id !== item.id));
      return;
    }

    const itemCusto = item.custoPainel || 0;

    // Se houver teto definido pelo custo do painel
    if (custoPainel > 0) {
      const selecionadosAtuais = listaExibicao.filter((c) => itensSelecionados.includes(c.id));
      const somaAtualPainel = selecionadosAtuais.reduce((acc, c) => acc + (c.custoPainel || 0), 0);

      // Se cabe no orçamento sem estourar o teto:
      if (somaAtualPainel + itemCusto <= custoPainel) {
        setItensSelecionados((prev) => [...prev, item.id]);
        return;
      }

      // Se não cabe: faz a substituição inteligente liberando espaço dos mais antigos
      let novosIds = [...itensSelecionados];
      while (novosIds.length > 0) {
        const somaNova = listaExibicao.filter((c) => novosIds.includes(c.id)).reduce((acc, c) => acc + (c.custoPainel || 0), 0);
        if (somaNova + itemCusto <= custoPainel) break;
        novosIds.shift();
      }
      novosIds.push(item.id);
      setItensSelecionados(novosIds);
      return;
    }

    setItensSelecionados((prev) => [...prev, item.id]);
  };

  const selecionarTodos = () => {
    if (custoPainel > 0) {
      let acumulado = 0;
      const ids = [];
      for (const c of listaExibicao) {
        if (acumulado + (c.custoPainel || 0) <= custoPainel) {
          ids.push(c.id);
          acumulado += (c.custoPainel || 0);
        }
      }
      setItensSelecionados(ids);
    } else {
      setItensSelecionados(listaExibicao.map((i) => i.id));
    }
  };

  const desmarcarTodos = () => {
    setItensSelecionados([]);
  };

  // Adicionar e remover peças estéticas manuais selecionadas do catálogo oficial
  const adicionarPecaEsteticaManual = (pecaDef) => {
    const novoId = `estetica_manual_${pecaDef.id}_${Date.now()}`;
    const novoItem = {
      id: novoId,
      categoria: pecaDef.categoria || "Estética",
      icone: pecaDef.icone || "🛠️",
      descricao: pecaDef.nome,
      detalhe: `Peça Estética Adicionada (${pecaDef.secao || "Estética"})`,
      custoPainel: pecaDef.custoPainel || 500,
      valor: pecaDef.valor || 5000,
      isManualEstetico: true
    };

    setItensEsteticosManuais((prev) => [...prev, novoItem]);

    const itemCusto = novoItem.custoPainel || 0;
    if (custoPainel > 0) {
      const listaComNovo = [...listaExibicao, novoItem];
      const selecionadosAtuais = listaComNovo.filter((c) => itensSelecionados.includes(c.id));
      const somaAtual = selecionadosAtuais.reduce((acc, c) => acc + (c.custoPainel || 0), 0);

      if (somaAtual + itemCusto <= custoPainel) {
        setItensSelecionados((prev) => [...prev, novoId]);
      } else {
        let novosIds = [...itensSelecionados];
        while (novosIds.length > 0) {
          const somaNova = listaComNovo.filter((c) => novosIds.includes(c.id)).reduce((acc, c) => acc + (c.custoPainel || 0), 0);
          if (somaNova + itemCusto <= custoPainel) break;
          novosIds.shift();
        }
        novosIds.push(novoId);
        setItensSelecionados(novosIds);
      }
    } else {
      setItensSelecionados((prev) => [...prev, novoId]);
    }

    setModalSeletorEstetico(false);
  };

  const removerPecaEsteticaManual = (id, e) => {
    if (e) e.stopPropagation();
    setItensEsteticosManuais((prev) => prev.filter((i) => i.id !== id));
    setItensSelecionados((prev) => prev.filter((iId) => iId !== id));
  };

  // Funções para gerenciar adicionais de bancada / inventário
  const toggleAdicionalBancada = (itemDef) => {
    setAdicionaisBancada((prev) => {
      const existe = prev.find((i) => i.id === itemDef.id);
      if (existe) {
        return prev.filter((i) => i.id !== itemDef.id);
      } else {
        return [...prev, { ...itemDef, quantidade: 1 }];
      }
    });
  };

  const alterarQtdAdicional = (id, delta) => {
    setAdicionaisBancada((prev) =>
      prev
        .map((i) => {
          if (i.id === id) {
            const novaQtd = (i.quantidade || 1) + delta;
            return novaQtd > 0 ? { ...i, quantidade: novaQtd } : null;
          }
          return i;
        })
        .filter(Boolean)
    );
  };

  const adicionarItemCustom = () => {
    if (!customNome.trim() || !customValor) return;
    const num = Number(String(customValor).replace(/\./g, "").replace(",", "."));
    if (isNaN(num) || num <= 0) return;

    setAdicionaisBancada((prev) => [
      ...prev,
      {
        id: `custom_${Date.now()}`,
        nome: customNome.trim(),
        icone: "🛠️",
        valor: num,
        quantidade: 1,
        categoria: "Serviço"
      }
    ]);
    setCustomNome("");
    setCustomValor("");
    setModalCustomAdicional(false);
  };

  // Itens ativos do diff/candidatos
  const itensAtivosDiff = listaExibicao.filter((item) => itensSelecionados.includes(item.id));
  const somaCustoPainelSelecionado = itensAtivosDiff.reduce((acc, item) => acc + (item.custoPainel || 0), 0);

  // Formatação dos adicionais de bancada para o padrão do extrato
  const adicionaisFormatados = adicionaisBancada.map((item) => ({
    categoria: item.categoria,
    icone: item.icone,
    descricao: (item.quantidade || 1) > 1 ? `${item.nome} (${item.quantidade}x)` : item.nome,
    detalhe: (item.quantidade || 1) > 1 ? `${item.quantidade}x de R$ ${item.valor.toLocaleString("pt-BR")}` : "Serviço de Bancada / Inventário",
    valor: item.valor * (item.quantidade || 1),
    isBancada: true,
    bancadaId: item.id
  }));

  // Lista consolidada final de itens
  const itensFinais = [...itensAtivosDiff, ...adicionaisFormatados];
  const totalACobrarAtivo = itensFinais.reduce((acc, item) => acc + item.valor, 0);
  const lucroOficina = totalACobrarAtivo - custoPainel;

  const copiarReciboModal = () => {
    const textoRecibo = formatarReciboDiscord({
      mecanicaNome: modalLogDetalhe.oficina_nome || "RED'S TUNERSHOP",
      baia: modalLogDetalhe.baia_nome || "Tunagem",
      tecnicoNome: modalLogDetalhe.tecnico_nome,
      tecnicoId: modalLogDetalhe.tecnico_id,
      donoNome: modalLogDetalhe.dono_nome,
      donoId: modalLogDetalhe.dono_id,
      veiculoNome: modalLogDetalhe.veiculo_nome,
      placa: modalLogDetalhe.placa,
      itensCobrados: itensFinais,
      totalACobrar: totalACobrarAtivo,
      valorPagoPainel: modalLogDetalhe.valor_pago,
      dataStr: `${modalLogDetalhe.data} ${modalLogDetalhe.hora || ""}`,
      fotoUrl: fotoRegistro
    });

    navigator.clipboard.writeText(textoRecibo);
    alert("✅ Recibo / Comanda copiada com sucesso! Cole no Discord da oficina ou envie ao cliente.");
  };

  const salvarConclusaoCobranca = async () => {
    if (salvandoCobranca) return;
    setSalvandoCobranca(true);

    try {
      const temPerformance = itensFinais.some((item) => item.categoria === "Performance");
      const temEstetica = itensFinais.some((item) => item.categoria !== "Performance");

      const WEBHOOK_ESTETICA = process.env.NEXT_PUBLIC_WEBHOOK_ESTETICA;
      const WEBHOOK_TUNAGEM = process.env.NEXT_PUBLIC_WEBHOOK_TUNAGEM;
      const webhookDestino = temPerformance ? (WEBHOOK_TUNAGEM || WEBHOOK_ESTETICA) : (WEBHOOK_ESTETICA || WEBHOOK_TUNAGEM);
      const canalNome = temPerformance ? "controle-tunagem" : "controle-estetica";

      const tituloRelatorio = temPerformance ? "🛠️ RELATÓRIO DE PERFORMANCE" : "🎨 RELATÓRIO DE ESTÉTICA";
      const corEmbed = temPerformance ? 15105570 : 3447003;

      const fields = [
        { name: "👨‍🔧 Mecânico", value: `${modalLogDetalhe.tecnico_nome || usuarioLogado?.nome} ${modalLogDetalhe.tecnico_id ? `(ID: ${modalLogDetalhe.tecnico_id})` : ""}`, inline: true },
        { name: "👤 Cliente", value: `${modalLogDetalhe.dono_nome || "Não informado"} ${modalLogDetalhe.dono_id ? `(ID: ${modalLogDetalhe.dono_id})` : ""}`, inline: true },
        { name: "🚗 Veículo", value: `${modalLogDetalhe.veiculo_nome || "Veículo"} (\`${modalLogDetalhe.placa || "N/A"}\`)`, inline: true },
        { name: "💰 Total Final", value: `**R$ ${Number(totalACobrarAtivo).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}**`, inline: false }
      ];

      if (temPerformance) {
        const pecasPerf = itensFinais
          .filter((i) => i.categoria === "Performance")
          .map((i) => `• **${i.descricao}** ${i.detalhe ? `(${i.detalhe})` : ""}: R$ ${Number(i.valor).toLocaleString("pt-BR")}`)
          .join("\n");
        fields.push({ name: "⚙️ Peças de Performance", value: pecasPerf || "Nenhuma", inline: false });
      }

      if (temEstetica) {
        const pecasEst = itensFinais
          .filter((i) => i.categoria !== "Performance")
          .map((i) => `• **${i.descricao}** ${i.detalhe ? `(${i.detalhe})` : ""}: R$ ${Number(i.valor).toLocaleString("pt-BR")}`)
          .join("\n");
        fields.push({
          name: "🎨 Estética & Visual",
          value: pecasEst.length > 1000 ? pecasEst.slice(0, 1000) + "..." : (pecasEst || "Nenhuma"),
          inline: false
        });
      }

      const discordEmbed = {
        title: tituloRelatorio,
        color: corEmbed,
        fields,
        footer: { text: "RED'S TUNERSHOP - Sistema de Logs" },
        timestamp: new Date().toISOString()
      };

      const formData = new FormData();
      if (fotoRegistro && fotoRegistro.startsWith("data:")) {
        const blob = dataURLtoBlob(fotoRegistro);
        if (blob) {
          formData.append("files[0]", blob, "print_veiculo.png");
          discordEmbed.image = { url: "attachment://print_veiculo.png" };
        }
      } else if (fotoRegistro && fotoRegistro.startsWith("http")) {
        discordEmbed.image = { url: fotoRegistro };
      }

      formData.append("payload_json", JSON.stringify({ embeds: [discordEmbed] }));

      let linkDiscord = "";

      if (webhookDestino) {
        try {
          const response = await fetch(webhookDestino + "?wait=true", {
            method: "POST",
            body: formData
          });

          if (response.ok) {
            const data = await response.json();
            const msgId = data.id;
            const chanId = data.channel_id || (webhookDestino.includes("/webhooks/") ? webhookDestino.split("/webhooks/")[1]?.split("/")[0] : null);
            const gldId = data.guild_id || "1486119705814106307";

            const directImageUrl =
              data.attachments?.[0]?.url ||
              data.embeds?.[0]?.image?.url ||
              data.attachments?.[0]?.proxy_url ||
              data.embeds?.[0]?.image?.proxy_url;

            if (directImageUrl) {
              linkDiscord = directImageUrl;
            } else if (msgId && chanId) {
              linkDiscord = `https://discord.com/channels/${gldId}/${chanId}/${msgId}`;
            }
          } else {
            console.warn("Discord Webhook respondeu com status:", response.status);
          }
        } catch (errWeb) {
          console.error("Erro ao enviar webhook para o Discord:", errWeb);
        }
      }

      // 1. Salva o serviço na tabela 'servicos'
      const tipoServico = temPerformance ? "tunagem" : "estetica";
      const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      const detalhesTexto = `${modalLogDetalhe.veiculo_nome || "Veículo"} (${modalLogDetalhe.placa || ""}) - ${itensFinais.map((i) => i.descricao).join(", ") || "Serviço Concluído"}`;

      try {
        await supabase.from("servicos").insert({
          funcionario_id: modalLogDetalhe.tecnico_id || usuarioLogado?.id,
          funcionario_nome: modalLogDetalhe.tecnico_nome || usuarioLogado?.nome,
          cliente_id: modalLogDetalhe.dono_id ? Number(modalLogDetalhe.dono_id) : null,
          cliente_nome: modalLogDetalhe.dono_nome || null,
          tipo: tipoServico,
          valor_total: totalACobrarAtivo,
          data: hoje,
          criado_em: new Date().toISOString(),
          link_imagem: linkDiscord || (fotoRegistro?.startsWith("http") ? fotoRegistro : null),
          detalhes: detalhesTexto
        });
      } catch (errServ) {
        console.warn("Aviso ao inserir em 'servicos':", errServ);
      }

      // 2. Atualiza as tabelas logs_tunagem_reds e logs_tunagem com status cobrado e foto
      const updateData = {
        foto_url: linkDiscord || (fotoRegistro?.startsWith("http") ? fotoRegistro : modalLogDetalhe.foto_url || null),
        cobrado: true
      };

      const targetUuid = modalLogDetalhe.uuid || modalLogDetalhe.id;
      if (targetUuid) {
        try {
          await supabase.from("logs_tunagem_reds").update(updateData).eq("uuid", targetUuid);
        } catch (errReds) {
          console.warn("Aviso ao atualizar 'logs_tunagem_reds':", errReds);
        }
        try {
          await supabase.from("logs_tunagem").update(updateData).eq("uuid", targetUuid);
        } catch (errLog) {
          console.warn("Aviso ao atualizar 'logs_tunagem':", errLog);
        }
      }

      alert(`✅ Serviço registrado com sucesso no canal #${canalNome} do Discord e marcado como finalizado!`);
      const updatedLog = {
        ...modalLogDetalhe,
        foto_url: linkDiscord || fotoRegistro || modalLogDetalhe.foto_url,
        cobrado: true
      };

      // Fecha a janela imediatamente após a confirmação conforme solicitado pelo usuário
      setModalLogDetalhe(null);
      if (onConcluido) onConcluido(updatedLog);
    } catch (e) {
      console.error("Erro ao concluir cobrança:", e);
      alert(`❌ Erro ao registrar serviço: ${e.message}`);
    } finally {
      setSalvandoCobranca(false);
    }
  };

  // Desbloquear ficha de serviço (Exclusivo para Donos / Admins)
  const desbloquearServico = async () => {
    if (!isDonoAdmin) return;
    if (
      !window.confirm(
        "Atenção Dono/Admin: Deseja desbloquear esta ficha de serviço? Isso permitirá que um funcionário ou você edite os itens e envie um novo registro de correção ao Discord."
      )
    ) {
      return;
    }

    setDesbloqueando(true);
    try {
      const targetUuid = modalLogDetalhe?.uuid || modalLogDetalhe?.id;
      if (targetUuid) {
        await supabase.from("logs_tunagem_reds").update({ cobrado: false }).eq("uuid", targetUuid);
        await supabase.from("logs_tunagem").update({ cobrado: false }).eq("uuid", targetUuid);
      }
      const logDesbloqueado = { ...modalLogDetalhe, cobrado: false };
      setModalLogDetalhe(logDesbloqueado);
      if (onConcluido) onConcluido(logDesbloqueado);
      alert("🔓 Ficha de serviço desbloqueada com sucesso! Agora é possível editar e reenviar normalmente.");
    } catch (err) {
      console.error("Erro ao desbloquear serviço:", err);
      alert("Erro ao desbloquear serviço: " + err.message);
    } finally {
      setDesbloqueando(false);
    }
  };

  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setFotoRegistro(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const salvarFotoAvulsa = async (urlParaSalvar) => {
    const urlFinal = (urlParaSalvar || inputLinkFoto || fotoRegistro || "").trim();
    if (!urlFinal) return;
    setSalvandoFotoAvulsa(true);
    try {
      const targetUuid = modalLogDetalhe?.uuid || modalLogDetalhe?.id;
      if (targetUuid) {
        await supabase.from("logs_tunagem_reds").update({ foto_url: urlFinal }).eq("uuid", targetUuid);
        await supabase.from("logs_tunagem").update({ foto_url: urlFinal }).eq("uuid", targetUuid);
      }
      if (modalLogDetalhe?.placa) {
        await supabase.from("servicos").update({ link_imagem: urlFinal }).ilike("detalhes", `%${modalLogDetalhe.placa}%`);
      }
      setFotoRegistro(urlFinal);
      setModalLogDetalhe((prev) => ({ ...prev, foto_url: urlFinal }));
      if (onConcluido) onConcluido();
      alert("✅ Link da foto atualizado com sucesso no sistema!");
      setModoLink(false);
      setInputLinkFoto("");
    } catch (err) {
      console.error("Erro ao salvar link da foto:", err);
      alert("Erro ao salvar foto: " + err.message);
    } finally {
      setSalvandoFotoAvulsa(false);
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
        background: "rgba(0,0,0,0.85)",
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px"
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) setModalLogDetalhe(null);
      }}
    >
      <div
        style={{
          background: theme?.card || "#1f2937",
          width: "100%",
          maxWidth: "860px",
          borderRadius: "20px",
          border: `1px solid ${theme?.border || "rgba(255,255,255,0.1)"}`,
          overflow: "hidden",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.75)"
        }}
      >
        {/* Header do Modal */}
        <div
          style={{
            padding: "18px 24px",
            background: theme?.card2 || "#111827",
            borderBottom: `1px solid ${theme?.border || "rgba(255,255,255,0.1)"}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px"
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "20px" }}>🚗</span>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "900", color: "#fff" }}>
                {modalLogDetalhe.veiculo_nome || "Veículo"}
              </h3>
              <span
                style={{
                  background: "rgba(56, 189, 248, 0.15)",
                  border: "1px solid rgba(56, 189, 248, 0.4)",
                  color: "#38bdf8",
                  padding: "3px 10px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: "900",
                  letterSpacing: "1px"
                }}
              >
                {modalLogDetalhe.placa || "SEM-PLACA"}
              </span>
              {modalLogDetalhe.cobrado ? (
                <span
                  style={{
                    background: "rgba(34, 197, 94, 0.15)",
                    border: "1px solid #22c55e",
                    color: "#4ade80",
                    padding: "3px 8px",
                    fontSize: "10px",
                    borderRadius: "6px",
                    fontWeight: "800",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px"
                  }}
                >
                  ✅ FINALIZADO
                </span>
              ) : (
                <span
                  style={{
                    background: "rgba(245, 158, 11, 0.15)",
                    border: "1px solid #f59e0b",
                    color: "#fbbf24",
                    padding: "3px 8px",
                    fontSize: "10px",
                    borderRadius: "6px",
                    fontWeight: "800",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px"
                  }}
                >
                  ⏳ PENDENTE
                </span>
              )}
            </div>
            <div style={{ fontSize: "12px", color: theme?.subtext || "#9ca3af", marginTop: "4px" }}>
              🧑‍🔧 Técnico: <b>{modalLogDetalhe.tecnico_nome}</b> (ID: {modalLogDetalhe.tecnico_id}) · 👤 Dono:{" "}
              <b>{modalLogDetalhe.dono_nome || "—"}</b> {modalLogDetalhe.dono_id ? `(ID: ${modalLogDetalhe.dono_id})` : ""}
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={copiarReciboModal}
              style={{
                background: "linear-gradient(135deg, #f59e0b 0%, #ec4899 100%)",
                border: "none",
                color: "#fff",
                padding: "8px 14px",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "800",
                fontSize: "12px",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              📋 Copiar Recibo Discord
            </button>
            <button
              onClick={() => setModalLogDetalhe(null)}
              style={{
                background: "rgba(255,255,255,0.05)",
                border: `1px solid ${theme?.border || "rgba(255,255,255,0.1)"}`,
                color: theme?.text || "#fff",
                padding: "8px 14px",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "800",
                fontSize: "12px"
              }}
            >
              FECHAR
            </button>
          </div>
        </div>

        {/* Corpo do Modal */}
        <div style={{ padding: "20px 24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* 3 Cards de Resumo Financeiro */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
            <div
              style={{
                background: "linear-gradient(135deg, rgba(34,197,94,0.15) 0%, rgba(34,197,94,0.03) 100%)",
                border: "1px solid rgba(34,197,94,0.4)",
                borderRadius: "12px",
                padding: "14px"
              }}
            >
              <div style={{ fontSize: "11px", fontWeight: "800", color: "#4ade80", textTransform: "uppercase" }}>
                💰 Valor a Cobrar do Cliente
              </div>
              <div style={{ fontSize: "22px", fontWeight: "900", color: "#4ade80", marginTop: "4px" }}>
                R$ {totalACobrarAtivo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div style={{ background: theme?.card2 || "#111827", border: `1px solid ${theme?.border || "rgba(255,255,255,0.1)"}`, borderRadius: "12px", padding: "14px" }}>
              <div style={{ fontSize: "11px", fontWeight: "800", color: theme?.subtext || "#9ca3af", textTransform: "uppercase" }}>
                ⚙️ Custo Painel in-game
              </div>
              <div style={{ fontSize: "18px", fontWeight: "900", color: "#fff", marginTop: "4px" }}>
                R$ {Number(modalLogDetalhe.valor_pago || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div style={{ background: theme?.card2 || "#111827", border: `1px solid ${theme?.border || "rgba(255,255,255,0.1)"}`, borderRadius: "12px", padding: "14px" }}>
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: "800",
                  color: lucroOficina >= 0 ? "#60a5fa" : "#f87171",
                  textTransform: "uppercase"
                }}
              >
                📈 MARGEM / LUCRO MECÂNICO
              </div>
              <div
                style={{
                  fontSize: "18px",
                  fontWeight: "900",
                  color: lucroOficina >= 0 ? "#60a5fa" : "#f87171",
                  marginTop: "4px"
                }}
              >
                R$ {lucroOficina.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Aviso inteligente de discrepância quando o painel registrou menos serviços que o diff */}
          {custoPainel > 0 && analiseModal.itensCobrados.length > 1 && !analiseModal.isFallbackPainel && (
            <div
              style={{
                background: "rgba(245, 158, 11, 0.1)",
                border: "1px solid rgba(245, 158, 11, 0.3)",
                borderRadius: "10px",
                padding: "10px 14px",
                fontSize: "12px",
                color: "#fbbf24",
                display: "flex",
                alignItems: "center",
                gap: "10px"
              }}
            >
              <span style={{ fontSize: "18px" }}>💡</span>
              <div>
                <b>Custo no painel: R$ {custoPainel.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.</b> Caso alguma alteração listada abaixo já fosse original do carro antes do serviço, <b>desmarque-a na caixinha</b> para que o total seja recalculado automaticamente.
              </div>
            </div>
          )}

          {/* Aviso de detecção automática quando o log gravou Antes e Depois idênticos */}
          {analiseModal.isFallbackPainel && (
            <div
              style={{
                background: "rgba(59, 130, 246, 0.12)",
                border: "1px solid rgba(59, 130, 246, 0.4)",
                borderRadius: "10px",
                padding: "10px 14px",
                fontSize: "12px",
                color: "#60a5fa",
                display: "flex",
                alignItems: "center",
                gap: "10px"
              }}
            >
              <span style={{ fontSize: "18px" }}>ℹ️</span>
              <div>
                <b>Detecção Automática por Custo de Painel:</b> O log do FiveM registrou o &quot;Antes&quot; e &quot;Depois&quot; idênticos, mas o mecânico pagou <b>R$ {custoPainel.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</b> no painel do jogo. O sistema identificou o pacote/serviço correspondente da tabela oficial.
              </div>
            </div>
          )}

          {/* Área de Anexar Foto / Comprovante do Registro */}
          <div
            style={{
              background: theme?.card2 || "#111827",
              border: `1px dashed ${fotoRegistro ? "#22c55e" : (theme?.border || "rgba(255,255,255,0.2)")}`,
              borderRadius: "14px",
              padding: "16px"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
              <div style={{ fontSize: "12px", fontWeight: "800", color: "#fff", display: "flex", alignItems: "center", gap: "6px" }}>
                <span>📸 Foto do Registro / Comprovante:</span>
                <span style={{ fontSize: "11px", color: theme?.subtext || "#9ca3af", fontWeight: "400" }}>
                  (Você pode dar <b>Ctrl + V</b> em qualquer lugar para colar sua print)
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <button
                  type="button"
                  onClick={() => setModoLink(!modoLink)}
                  style={{
                    background: "rgba(56, 189, 248, 0.12)",
                    border: "1px solid rgba(56, 189, 248, 0.3)",
                    color: "#38bdf8",
                    padding: "4px 10px",
                    borderRadius: "6px",
                    fontSize: "11px",
                    fontWeight: "800",
                    cursor: "pointer"
                  }}
                >
                  🔗 {modoLink ? "Fechar Link" : "Inserir Link"}
                </button>
                {fotoRegistro && (
                  <button
                    type="button"
                    onClick={() => setFotoRegistro("")}
                    style={{
                      background: "rgba(239,68,68,0.15)",
                      border: "1px solid #ef4444",
                      color: "#f87171",
                      padding: "4px 10px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: "800",
                      cursor: "pointer"
                    }}
                  >
                    🗑️ Remover Foto
                  </button>
                )}
              </div>
            </div>

            {/* Caixa de Entrada de Link Manual da Imagem */}
            {modoLink && (
              <div
                style={{
                  marginBottom: "12px",
                  padding: "12px",
                  background: "rgba(0,0,0,0.35)",
                  borderRadius: "10px",
                  border: "1px solid rgba(56, 189, 248, 0.25)"
                }}
              >
                <div style={{ fontSize: "11px", fontWeight: "700", color: "#38bdf8", marginBottom: "6px" }}>
                  🔗 Cole a URL direta da imagem (ex: https://cdn.discordapp.com/attachments/...):
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="text"
                    placeholder="https://cdn.discordapp.com/attachments/..."
                    value={inputLinkFoto}
                    onChange={(e) => setInputLinkFoto(e.target.value)}
                    style={{
                      flex: 1,
                      background: "#111827",
                      border: "1px solid rgba(255,255,255,0.2)",
                      borderRadius: "8px",
                      padding: "8px 12px",
                      color: "#fff",
                      fontSize: "12px"
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!inputLinkFoto.trim()) return;
                      if (modalLogDetalhe?.cobrado) {
                        salvarFotoAvulsa(inputLinkFoto.trim());
                      } else {
                        setFotoRegistro(inputLinkFoto.trim());
                        setModoLink(false);
                        setInputLinkFoto("");
                      }
                    }}
                    disabled={salvandoFotoAvulsa}
                    style={{
                      background: "#22c55e",
                      border: "none",
                      color: "#fff",
                      padding: "8px 14px",
                      borderRadius: "8px",
                      fontWeight: "800",
                      fontSize: "11px",
                      cursor: "pointer"
                    }}
                  >
                    {salvandoFotoAvulsa ? "Salvando..." : (modalLogDetalhe?.cobrado ? "💾 Salvar Link" : "Aplicar")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModoLink(false);
                      setInputLinkFoto("");
                    }}
                    style={{
                      background: "rgba(255,255,255,0.1)",
                      border: "none",
                      color: "#fff",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      fontSize: "11px",
                      cursor: "pointer"
                    }}
                  >
                    Cancelar
                  </button>
                </div>
                {inputLinkFoto.includes("discord.com/channels/") && (
                  <div style={{ marginTop: "8px", fontSize: "11px", color: "#f87171" }}>
                    ⚠️ Atenção: links com &quot;discord.com/channels/...&quot; são links de texto da mensagem do chat e não carregam a foto. No Discord, clique com o <b>botão direito na foto do card</b> e escolha <b>&quot;Copiar Link&quot;</b> (que começa com <code>https://cdn.discordapp.com/attachments/...</code>).
                  </div>
                )}
              </div>
            )}

            {fotoRegistro ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                {fotoRegistro.includes("discord.com/channels/") ? (
                  <div
                    style={{
                      padding: "14px",
                      background: "rgba(239, 68, 68, 0.1)",
                      border: "1px solid #ef4444",
                      borderRadius: "10px",
                      textAlign: "center",
                      color: "#f87171",
                      fontSize: "12px",
                      maxWidth: "460px"
                    }}
                  >
                    <div style={{ fontWeight: "800", marginBottom: "4px" }}>⚠️ Link do Chat do Discord Detectado</div>
                    <div>Este link aponta para a mensagem de texto do Discord, não para o arquivo de imagem.</div>
                    <div style={{ marginTop: "8px" }}>
                      <button
                        type="button"
                        onClick={() => setModoLink(true)}
                        style={{
                          background: "#38bdf8",
                          color: "#000",
                          border: "none",
                          padding: "6px 12px",
                          borderRadius: "6px",
                          fontWeight: "800",
                          fontSize: "11px",
                          cursor: "pointer"
                        }}
                      >
                        🔗 Substituir pelo Link Direto da Imagem
                      </button>
                    </div>
                  </div>
                ) : (
                  <img
                    src={fotoRegistro}
                    alt="Comprovante de Tunagem"
                    style={{
                      maxWidth: "100%",
                      maxHeight: "240px",
                      borderRadius: "10px",
                      border: "1px solid rgba(255,255,255,0.1)",
                      objectFit: "contain"
                    }}
                  />
                )}
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
                  <div style={{ fontSize: "11px", color: "#4ade80", fontWeight: "800" }}>
                    ✅ Foto anexada com sucesso!
                  </div>
                  {modalLogDetalhe?.cobrado && (
                    <button
                      type="button"
                      onClick={() => salvarFotoAvulsa()}
                      disabled={salvandoFotoAvulsa}
                      style={{
                        background: "rgba(34, 197, 94, 0.15)",
                        border: "1px solid #22c55e",
                        color: "#4ade80",
                        padding: "3px 10px",
                        borderRadius: "6px",
                        fontSize: "11px",
                        fontWeight: "800",
                        cursor: "pointer"
                      }}
                    >
                      💾 {salvandoFotoAvulsa ? "Salvando..." : "Salvar Foto no Sistema"}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "16px 10px" }}>
                <div style={{ fontSize: "28px", marginBottom: "6px" }}>📋 ➔ 🖼️</div>
                <div style={{ fontSize: "13px", color: "#fff", fontWeight: "700" }}>
                  Aperte <b>Ctrl + V</b> para colar a print do serviço
                </div>
                <div style={{ fontSize: "11px", color: theme?.subtext || "#9ca3af", marginTop: "4px" }}>
                  ou escolha uma das opções abaixo:
                </div>
                <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginTop: "10px", flexWrap: "wrap" }}>
                  <label
                    style={{
                      display: "inline-block",
                      background: "rgba(255,255,255,0.06)",
                      border: `1px solid ${theme?.border || "rgba(255,255,255,0.2)"}`,
                      color: "#fff",
                      padding: "6px 14px",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontWeight: "700",
                      cursor: "pointer"
                    }}
                  >
                    📁 Selecionar Arquivo
                    <input type="file" accept="image/*" onChange={handleFileInput} style={{ display: "none" }} />
                  </label>
                  <button
                    type="button"
                    onClick={() => setModoLink(true)}
                    style={{
                      background: "rgba(56, 189, 248, 0.12)",
                      border: "1px solid rgba(56, 189, 248, 0.3)",
                      color: "#38bdf8",
                      padding: "6px 14px",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontWeight: "700",
                      cursor: "pointer"
                    }}
                  >
                    🔗 Inserir Link da Imagem
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* BARRA DE ADICIONAIS DE BANCADA / INVENTÁRIO (NITRO, KIT DRIFT, REPARO, PNEU) */}
          {/* ========================================================================= */}
          <div
            style={{
              background: "linear-gradient(135deg, rgba(20, 184, 166, 0.08) 0%, rgba(20, 184, 166, 0.02) 100%)",
              border: "1px solid rgba(20, 184, 166, 0.3)",
              borderRadius: "14px",
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              gap: "10px"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
              <div style={{ fontSize: "12px", fontWeight: "900", color: "#2dd4bf", display: "flex", alignItems: "center", gap: "6px", textTransform: "uppercase" }}>
                <span>⚡</span>
                <span>Serviços de Bancada & Inventário (Fora do Menu):</span>
              </div>
              <div style={{ fontSize: "11px", color: theme?.subtext || "#9ca3af" }}>
                Clique para incluir ou remover da comanda
              </div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {ITENS_BANCADA_OPCOES.map((itemDef) => {
                const instalado = adicionaisBancada.find((i) => i.id === itemDef.id);
                return (
                  <div key={itemDef.id} style={{ display: "inline-flex", alignItems: "center" }}>
                    {!itemDef.permiteQtd ? (
                      <button
                        type="button"
                        onClick={() => toggleAdicionalBancada(itemDef)}
                        style={{
                          background: instalado ? "linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)" : "rgba(255,255,255,0.05)",
                          border: instalado ? "1px solid #2dd4bf" : `1px solid ${theme?.border || "rgba(255,255,255,0.15)"}`,
                          color: instalado ? "#fff" : (theme?.text || "#fff"),
                          padding: "8px 12px",
                          borderRadius: "8px",
                          fontSize: "12px",
                          fontWeight: "800",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          boxShadow: instalado ? "0 0 12px rgba(20, 184, 166, 0.4)" : "none",
                          transition: "all 0.15s ease"
                        }}
                      >
                        <span>{itemDef.icone}</span>
                        <span>{itemDef.nome}</span>
                        <span style={{ fontSize: "11px", opacity: 0.85, background: "rgba(0,0,0,0.2)", padding: "2px 6px", borderRadius: "4px" }}>
                          R$ {itemDef.valor.toLocaleString("pt-BR")}
                        </span>
                        {instalado && <span style={{ color: "#fff", fontWeight: "900" }}>✓</span>}
                      </button>
                    ) : (
                      <div
                        style={{
                          background: instalado ? "rgba(20, 184, 166, 0.15)" : "rgba(255,255,255,0.05)",
                          border: instalado ? "1px solid #2dd4bf" : `1px solid ${theme?.border || "rgba(255,255,255,0.15)"}`,
                          borderRadius: "8px",
                          display: "inline-flex",
                          alignItems: "center",
                          overflow: "hidden"
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => toggleAdicionalBancada(itemDef)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: instalado ? "#2dd4bf" : (theme?.text || "#fff"),
                            padding: "8px 10px",
                            fontSize: "12px",
                            fontWeight: "800",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px"
                          }}
                        >
                          <span>{itemDef.icone}</span>
                          <span>{itemDef.nome}</span>
                          <span style={{ fontSize: "11px", opacity: 0.85 }}>
                            (R$ {itemDef.valor.toLocaleString("pt-BR")}/un)
                          </span>
                        </button>

                        {instalado ? (
                          <div style={{ display: "flex", alignItems: "center", background: "rgba(0,0,0,0.3)", padding: "2px 6px", gap: "6px" }}>
                            <button
                              type="button"
                              onClick={() => alterarQtdAdicional(itemDef.id, -1)}
                              style={{ background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", width: "20px", height: "20px", borderRadius: "4px", cursor: "pointer", fontWeight: "900" }}
                            >
                              -
                            </button>
                            <span style={{ fontSize: "12px", fontWeight: "900", color: "#fff", minWidth: "16px", textAlign: "center" }}>
                              {instalado.quantidade || 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => alterarQtdAdicional(itemDef.id, 1)}
                              style={{ background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", width: "20px", height: "20px", borderRadius: "4px", cursor: "pointer", fontWeight: "900" }}
                            >
                              +
                            </button>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}

              <button
                type="button"
                onClick={() => setModalCustomAdicional(true)}
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: `1px dashed ${theme?.border || "rgba(255,255,255,0.25)"}`,
                  color: theme?.subtext || "#9ca3af",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: "800",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                <span>➕</span>
                <span>Outro Adicional</span>
              </button>
            </div>
          </div>

          {/* Modal / Popup Inline para Item Customizado */}
          {modalCustomAdicional && (
            <div
              style={{
                background: theme?.card2 || "#111827",
                border: "1px solid #38bdf8",
                borderRadius: "12px",
                padding: "14px 16px",
                display: "flex",
                flexDirection: "column",
                gap: "10px"
              }}
            >
              <div style={{ fontSize: "12px", fontWeight: "800", color: "#38bdf8" }}>
                ➕ Adicionar Serviço Manual Personalizado
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <input
                  type="text"
                  placeholder="Nome do serviço (ex: Lavagem Premium, Troca de Óleo)"
                  value={customNome}
                  onChange={(e) => setCustomNome(e.target.value)}
                  style={{
                    flex: 2,
                    minWidth: "200px",
                    background: "rgba(255,255,255,0.05)",
                    border: `1px solid ${theme?.border || "rgba(255,255,255,0.2)"}`,
                    color: "#fff",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    fontSize: "12px"
                  }}
                />
                <input
                  type="number"
                  placeholder="Valor em R$ (ex: 15000)"
                  value={customValor}
                  onChange={(e) => setCustomValor(e.target.value)}
                  style={{
                    flex: 1,
                    minWidth: "120px",
                    background: "rgba(255,255,255,0.05)",
                    border: `1px solid ${theme?.border || "rgba(255,255,255,0.2)"}`,
                    color: "#fff",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    fontSize: "12px"
                  }}
                />
                <button
                  type="button"
                  onClick={adicionarItemCustom}
                  style={{
                    background: "#0284c7",
                    border: "none",
                    color: "#fff",
                    padding: "8px 14px",
                    borderRadius: "8px",
                    fontWeight: "800",
                    fontSize: "12px",
                    cursor: "pointer"
                  }}
                >
                  Adicionar
                </button>
                <button
                  type="button"
                  onClick={() => setModalCustomAdicional(false)}
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: `1px solid ${theme?.border || "rgba(255,255,255,0.15)"}`,
                    color: theme?.subtext || "#9ca3af",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    fontWeight: "700",
                    fontSize: "12px",
                    cursor: "pointer"
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Seletor de visualização: Extrato vs JSON Bruto */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${theme?.border || "rgba(255,255,255,0.1)"}`, paddingBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => setAbaModalDetalhe("extrato")}
                style={{
                  background: abaModalDetalhe === "extrato" ? "rgba(236,72,153,0.15)" : "transparent",
                  border: abaModalDetalhe === "extrato" ? "1px solid #ec4899" : "1px solid transparent",
                  color: abaModalDetalhe === "extrato" ? "#f472b6" : (theme?.subtext || "#9ca3af"),
                  padding: "6px 14px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: "800",
                  cursor: "pointer"
                }}
              >
                📋 Extrato de Modificações ({itensFinais.length} itens cobrados)
              </button>

              {podeVerJsonBruto && <button
                onClick={() => setAbaModalDetalhe("json")}
                style={{
                  background: abaModalDetalhe === "json" ? "rgba(139,92,246,0.15)" : "transparent",
                  border: abaModalDetalhe === "json" ? "1px solid #8b5cf6" : "1px solid transparent",
                  color: abaModalDetalhe === "json" ? "#c084fc" : (theme?.subtext || "#9ca3af"),
                  padding: "6px 14px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: "800",
                  cursor: "pointer"
                }}
              >
                {`{ } JSON Bruto (Antes x Depois)`}
              </button>}
            </div>

            {abaModalDetalhe === "extrato" && (
              <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => setModalSeletorEstetico(true)}
                  style={{
                    background: "linear-gradient(135deg, rgba(236,72,153,0.18) 0%, rgba(139,92,246,0.18) 100%)",
                    border: "1px solid #ec4899",
                    color: "#f472b6",
                    padding: "5px 12px",
                    borderRadius: "8px",
                    fontSize: "11px",
                    fontWeight: "800",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    boxShadow: "0 0 10px rgba(236,72,153,0.2)"
                  }}
                  title="Selecione qualquer serviço ou peça estética oficial (Aerofólio, Capô, Para-choque, Pintura, etc.)"
                >
                  <span>🎨</span>
                  <span>+ Adicionar / Trocar Serviço Estético</span>
                </button>

                {listaExibicao.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={selecionarTodos}
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        border: `1px solid ${theme?.border || "rgba(255,255,255,0.15)"}`,
                        color: theme?.text || "#fff",
                        padding: "4px 8px",
                        borderRadius: "6px",
                        fontSize: "11px",
                        fontWeight: "700",
                        cursor: "pointer"
                      }}
                    >
                      Marcar Todos
                    </button>
                    <button
                      type="button"
                      onClick={desmarcarTodos}
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        border: `1px solid ${theme?.border || "rgba(255,255,255,0.15)"}`,
                        color: theme?.subtext || "#9ca3af",
                        padding: "4px 8px",
                        borderRadius: "6px",
                        fontSize: "11px",
                        fontWeight: "700",
                        cursor: "pointer"
                      }}
                    >
                      Desmarcar Todos
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Conteúdo: Extrato Discriminado com Checkbox Interativo e Adicionais de Bancada */}
          {abaModalDetalhe === "extrato" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {/* 1. Adicionais Manuais de Bancada Selecionados */}
              {adicionaisFormatados.map((item) => (
                <div
                  key={`bancada_${item.bancadaId}`}
                  style={{
                    background: "linear-gradient(135deg, rgba(20, 184, 166, 0.15) 0%, rgba(20, 184, 166, 0.05) 100%)",
                    border: "1px solid rgba(20, 184, 166, 0.4)",
                    borderRadius: "10px",
                    padding: "12px 14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    transition: "all 0.15s ease"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ fontSize: "20px" }}>{item.icone || "⚡"}</span>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "13px", fontWeight: "900", color: "#fff" }}>
                          {item.descricao}
                        </span>
                        <span
                          style={{
                            background: "rgba(20, 184, 166, 0.25)",
                            border: "1px solid #2dd4bf",
                            color: "#2dd4bf",
                            fontSize: "10px",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            fontWeight: "900"
                          }}
                        >
                          ⚡ BANCADA / INVENTÁRIO
                        </span>
                      </div>
                      {item.detalhe && (
                        <div style={{ fontSize: "11px", color: theme?.subtext || "#9ca3af", marginTop: "2px" }}>
                          {item.detalhe}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ fontSize: "14px", fontWeight: "900", color: "#4ade80" }}>
                      R$ {item.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </div>
                    <button
                      type="button"
                      onClick={() => setAdicionaisBancada((prev) => prev.filter((b) => b.id !== item.bancadaId))}
                      style={{
                        background: "rgba(239,68,68,0.15)",
                        border: "1px solid rgba(239,68,68,0.3)",
                        color: "#f87171",
                        width: "26px",
                        height: "26px",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontWeight: "800",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                      title="Remover Adicional"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}

              {/* Barra de Seleção Inteligente de Candidatos (quando fallback) */}
              {analiseModal.isFallbackPainel && custoPainel > 0 && (
                <div
                  style={{
                    background: "linear-gradient(135deg, rgba(56, 189, 248, 0.1) 0%, rgba(56, 189, 248, 0.02) 100%)",
                    border: "1px solid rgba(56, 189, 248, 0.3)",
                    borderRadius: "10px",
                    padding: "10px 14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "8px",
                    marginBottom: "4px"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "16px" }}>🎯</span>
                    <div>
                      <div style={{ fontSize: "12px", fontWeight: "900", color: "#38bdf8", textTransform: "uppercase" }}>
                        Seleção Inteligente de Serviços (Teto do Painel: R$ {custoPainel.toLocaleString("pt-BR")})
                      </div>
                      <div style={{ fontSize: "11px", color: theme?.subtext || "#9ca3af", marginTop: "1px" }}>
                        {listaExibicao.length > 1
                          ? `Detectamos ${listaExibicao.length} opções possíveis no veículo. Clique na opção desejada para alternar!`
                          : "1 opção identificada compatível com o valor pago no painel."}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => setModalSeletorEstetico(true)}
                      style={{
                        background: "rgba(236,72,153,0.2)",
                        border: "1px solid #ec4899",
                        color: "#f472b6",
                        padding: "4px 10px",
                        borderRadius: "6px",
                        fontSize: "11px",
                        fontWeight: "800",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px"
                      }}
                      title="Clique para escolher qualquer outra peça estética oficial (ex: Aerofólio, Capô)"
                    >
                      <span>🎨</span>
                      <span>+ Escolher Peça (ex: Aerofólio)</span>
                    </button>
                    <span style={{ fontSize: "11px", fontWeight: "800", color: somaCustoPainelSelecionado === custoPainel ? "#4ade80" : "#fbbf24" }}>
                      Painel: R$ {somaCustoPainelSelecionado.toLocaleString("pt-BR")} / R$ {custoPainel.toLocaleString("pt-BR")}
                    </span>
                    <span
                      style={{
                        background: somaCustoPainelSelecionado === custoPainel ? "rgba(34, 197, 94, 0.2)" : "rgba(245, 158, 11, 0.2)",
                        border: `1px solid ${somaCustoPainelSelecionado === custoPainel ? "#22c55e" : "#f59e0b"}`,
                        color: somaCustoPainelSelecionado === custoPainel ? "#4ade80" : "#fbbf24",
                        fontSize: "10px",
                        fontWeight: "900",
                        padding: "2px 6px",
                        borderRadius: "4px"
                      }}
                    >
                      {somaCustoPainelSelecionado === custoPainel ? "100% PREENCHIDO" : "PARCIAL"}
                    </span>
                  </div>
                </div>
              )}

              {/* 2. Modificações Detectadas no Diff ou Candidatos do Veículo */}
              {listaExibicao.map((item) => {
                const estaMarcado = itensSelecionados.includes(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => toggleItem(item)}
                    style={{
                      background: estaMarcado ? (theme?.card2 || "#111827") : "rgba(255,255,255,0.02)",
                      border: estaMarcado ? `1px solid rgba(56, 189, 248, 0.4)` : `1px dashed ${theme?.border || "rgba(255,255,255,0.1)"}`,
                      borderRadius: "10px",
                      padding: "12px 14px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      cursor: "pointer",
                      opacity: estaMarcado ? 1 : 0.6,
                      transition: "all 0.15s ease"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div
                        style={{
                          width: "20px",
                          height: "20px",
                          borderRadius: "5px",
                          background: estaMarcado ? "#0284c7" : "transparent",
                          border: estaMarcado ? "1px solid #38bdf8" : `2px solid ${theme?.subtext || "#6b7280"}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#fff",
                          fontSize: "12px",
                          fontWeight: "900",
                          flexShrink: 0
                        }}
                      >
                        {estaMarcado ? "✓" : ""}
                      </div>

                      <span style={{ fontSize: "20px" }}>{item.icone || "🛠️"}</span>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "13px", fontWeight: "800", color: estaMarcado ? "#fff" : theme?.subtext || "#9ca3af", textDecoration: estaMarcado ? "none" : "none" }}>
                            {item.descricao}
                          </span>
                          {item.isManualEstetico && (
                            <span
                              style={{
                                background: "rgba(236,72,153,0.25)",
                                color: "#f472b6",
                                border: "1px solid #ec4899",
                                fontSize: "10px",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                fontWeight: "800"
                              }}
                            >
                              🎨 MANUAL / CORREÇÃO
                            </span>
                          )}
                          {estaMarcado ? (
                            <span
                              style={{
                                background: "rgba(34, 197, 94, 0.2)",
                                color: "#4ade80",
                                border: "1px solid rgba(34, 197, 94, 0.4)",
                                fontSize: "10px",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                fontWeight: "800"
                              }}
                            >
                              ✓ INCLUÍDO NA COMANDA
                            </span>
                          ) : (
                            <span
                              style={{
                                background: "rgba(56, 189, 248, 0.12)",
                                color: "#38bdf8",
                                border: "1px solid rgba(56, 189, 248, 0.3)",
                                fontSize: "10px",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                fontWeight: "800"
                              }}
                            >
                              💡 DISPONÍVEL NO VEÍCULO (CLIQUE PARA TROCAR)
                            </span>
                          )}
                        </div>
                        {item.detalhe && (
                          <div style={{ fontSize: "11px", color: theme?.subtext || "#9ca3af", marginTop: "2px" }}>
                            {item.detalhe} {item.custoPainel ? `· (Custo Painel: R$ ${Number(item.custoPainel).toLocaleString("pt-BR")})` : ""}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div
                        style={{
                          fontSize: "14px",
                          fontWeight: "900",
                          color: estaMarcado ? "#4ade80" : theme?.subtext || "#9ca3af"
                        }}
                      >
                        R$ {item.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </div>
                      {item.isManualEstetico && (
                        <button
                          type="button"
                          onClick={(e) => removerPecaEsteticaManual(item.id, e)}
                          style={{
                            background: "rgba(239,68,68,0.15)",
                            border: "1px solid rgba(239,68,68,0.3)",
                            color: "#f87171",
                            width: "24px",
                            height: "24px",
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontWeight: "800",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center"
                          }}
                          title="Remover peça da ficha"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {analiseModal.itensCobrados.length === 0 && adicionaisFormatados.length === 0 && (
                <div style={{ padding: "24px", textAlign: "center", color: theme?.subtext || "#9ca3af", fontSize: "13px" }}>
                  Nenhum serviço ou peça adicionada neste serviço. Use os botões acima para adicionar Nitro, Drift, Reparo ou Pneu.
                </div>
              )}
            </div>
          )}

          {/* Conteúdo: JSON Bruto */}
          {podeVerJsonBruto && abaModalDetalhe === "json" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div
                style={{
                  background: "rgba(239,68,68,0.05)",
                  border: "1px solid rgba(239,68,68,0.2)",
                  borderRadius: "12px",
                  padding: "14px"
                }}
              >
                <div style={{ fontSize: "12px", fontWeight: "800", color: "#f87171", marginBottom: "8px" }}>
                  [Antes da Modificação]:
                </div>
                <pre style={{ margin: 0, fontSize: "11px", color: theme?.subtext || "#9ca3af", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                  {modalLogDetalhe.antes_json ? JSON.stringify(modalLogDetalhe.antes_json, null, 2) : "Sem modificações prévias"}
                </pre>
              </div>

              <div
                style={{
                  background: "rgba(34,197,94,0.05)",
                  border: "1px solid rgba(34,197,94,0.2)",
                  borderRadius: "12px",
                  padding: "14px"
                }}
              >
                <div style={{ fontSize: "12px", fontWeight: "800", color: "#4ade80", marginBottom: "8px" }}>
                  [Depois da Modificação]:
                </div>
                <pre style={{ margin: 0, fontSize: "11px", color: theme?.subtext || "#9ca3af", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                  {modalLogDetalhe.depois_json ? JSON.stringify(modalLogDetalhe.depois_json, null, 2) : "Nenhuma alteração"}
                </pre>
              </div>
            </div>
          )}

          {/* Ações de Conclusão de Cobrança & Envio ao Discord */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "6px" }}>
            {modalLogDetalhe.cobrado ? (
              <div
                style={{
                  background: "rgba(34, 197, 94, 0.08)",
                  border: "1px solid rgba(34, 197, 94, 0.3)",
                  borderRadius: "14px",
                  padding: "16px 20px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "12px"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontSize: "28px" }}>✅</span>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: "900", color: "#4ade80" }}>
                      SERVIÇO FINALIZADO E REGISTRADO NO DISCORD
                    </div>
                    <div style={{ fontSize: "12px", color: theme?.subtext || "#9ca3af", marginTop: "2px" }}>
                      Esta comanda já foi confirmada e lançada. O envio duplicado está desativado para segurança do financeiro.
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  {isDonoAdmin ? (
                    <button
                      onClick={desbloquearServico}
                      disabled={desbloqueando}
                      style={{
                        background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                        border: "none",
                        color: "#fff",
                        padding: "10px 18px",
                        borderRadius: "10px",
                        fontSize: "12px",
                        fontWeight: "900",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        boxShadow: "0 4px 14px rgba(239,68,68,0.35)"
                      }}
                    >
                      🔓 {desbloqueando ? "Desbloqueando..." : "Desbloquear Serviço (Dono/Admin)"}
                    </button>
                  ) : (
                    <span style={{ fontSize: "11px", color: theme?.subtext || "#9ca3af", fontStyle: "italic" }}>
                      🔒 Apenas Donos / Admins podem desbloquear em caso de erro
                    </span>
                  )}

                  <button
                    onClick={() => setModalLogDetalhe(null)}
                    style={{
                      background: "rgba(255,255,255,0.08)",
                      border: `1px solid ${theme?.border || "rgba(255,255,255,0.2)"}`,
                      color: "#fff",
                      padding: "10px 18px",
                      borderRadius: "10px",
                      fontSize: "12px",
                      fontWeight: "800",
                      cursor: "pointer"
                    }}
                  >
                    Fechar
                  </button>
                </div>
              </div>
            ) : (
              (() => {
                const temPerf = analiseModal.itensCobrados.some((item) => item.categoria === "Performance");
                return (
                  <button
                    onClick={salvarConclusaoCobranca}
                    disabled={salvandoCobranca}
                    style={{
                      flex: 1,
                      background: temPerf
                        ? "linear-gradient(135deg, #f97316 0%, #ea580c 100%)"
                        : "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                      border: "none",
                      color: "#fff",
                      padding: "14px 20px",
                      borderRadius: "12px",
                      fontSize: "14px",
                      fontWeight: "900",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      boxShadow: temPerf ? "0 4px 16px rgba(249,115,22,0.4)" : "0 4px 16px rgba(2,132,199,0.4)"
                    }}
                  >
                    {salvandoCobranca
                      ? "Enviando ao Discord e Salvando..."
                      : `🚀 Concluir & Enviar ao Discord (#${temPerf ? "controle-tunagem" : "controle-estetica"})`}
                  </button>
                );
              })()
            )}
          </div>

          {/* Rodapé com Identificadores */}
          <div
            style={{
              background: theme?.card2 || "#111827",
              borderRadius: "10px",
              padding: "12px",
              fontSize: "11px",
              color: theme?.subtext || "#9ca3af",
              display: "flex",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "8px"
            }}
          >
            <div>
              <b>UUID:</b> {modalLogDetalhe.uuid}
            </div>
            <div>
              <b>Data:</b> {modalLogDetalhe.data} às {modalLogDetalhe.hora}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL / POPUP: SELETOR DE PEÇAS & SERVIÇOS ESTÉTICOS DA TABELA OFICIAL */}
      {/* ========================================================================= */}
      {modalSeletorEstetico && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.85)",
            backdropFilter: "blur(6px)",
            zIndex: 100000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px"
          }}
          onClick={() => setModalSeletorEstetico(false)}
        >
          <div
            style={{
              background: theme?.card || "#111827",
              border: "1px solid #ec4899",
              borderRadius: "18px",
              width: "100%",
              maxWidth: "680px",
              maxHeight: "88vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 20px 50px rgba(0,0,0,0.9), 0 0 30px rgba(236,72,153,0.35)",
              animation: "fadeIn 0.2s ease-out"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header do Seletor */}
            <div
              style={{
                padding: "16px 20px",
                background: theme?.card2 || "#1f2937",
                borderBottom: `1px solid ${theme?.border || "rgba(255,255,255,0.1)"}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}
            >
              <div>
                <div style={{ fontSize: "16px", fontWeight: "900", color: "#fff", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>🎨</span>
                  <span>Catálogo de Peças & Serviços Estéticos (Oficina Reds)</span>
                </div>
                <div style={{ fontSize: "11px", color: theme?.subtext || "#9ca3af", marginTop: "2px" }}>
                  Selecione a peça instalada. Regra: <b>Custo Painel: R$ 500</b> | <b>Comanda Cliente: R$ 5.000</b>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalSeletorEstetico(false)}
                style={{
                  background: "rgba(255,255,255,0.1)",
                  border: "none",
                  color: "#fff",
                  width: "28px",
                  height: "28px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "900",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                ✕
              </button>
            </div>

            {/* Barra de Busca e Categorias */}
            <div
              style={{
                padding: "14px 20px",
                borderBottom: `1px solid ${theme?.border || "rgba(255,255,255,0.08)"}`,
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                background: "rgba(0,0,0,0.2)"
              }}
            >
              <input
                type="text"
                placeholder="🔍 Digite para buscar peça (ex: Aerofólio, Capô, Para-choque, Pintura, Roda...)"
                value={buscaEstetica}
                onChange={(e) => setBuscaEstetica(e.target.value)}
                autoFocus
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.06)",
                  border: `1px solid ${theme?.border || "rgba(255,255,255,0.2)"}`,
                  borderRadius: "10px",
                  padding: "10px 14px",
                  color: "#fff",
                  fontSize: "13px",
                  outline: "none"
                }}
              />

              {/* Categorias / Seções */}
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {["Todas", "Lataria", "Rodas & Vidros", "Pintura", "Iluminação", "Interior"].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setSecaoEsteticaFiltro(sec)}
                    style={{
                      background: secaoEsteticaFiltro === sec ? "linear-gradient(135deg, #ec4899 0%, #db2777 100%)" : "rgba(255,255,255,0.06)",
                      border: secaoEsteticaFiltro === sec ? "1px solid #f472b6" : `1px solid ${theme?.border || "rgba(255,255,255,0.12)"}`,
                      color: secaoEsteticaFiltro === sec ? "#fff" : (theme?.subtext || "#9ca3af"),
                      padding: "5px 12px",
                      borderRadius: "8px",
                      fontSize: "11px",
                      fontWeight: "800",
                      cursor: "pointer",
                      transition: "all 0.15s ease"
                    }}
                  >
                    {sec}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid com as Peças Disponíveis */}
            <div
              style={{
                padding: "16px 20px",
                overflowY: "auto",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: "10px"
              }}
            >
              {pecasFiltradas.map((peca) => (
                <button
                  key={peca.id}
                  type="button"
                  onClick={() => adicionarPecaEsteticaManual(peca)}
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: `1px solid ${theme?.border || "rgba(255,255,255,0.12)"}`,
                    borderRadius: "12px",
                    padding: "12px 14px",
                    textAlign: "left",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    transition: "all 0.15s ease"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#ec4899";
                    e.currentTarget.style.background = "rgba(236,72,153,0.12)";
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = theme?.border || "rgba(255,255,255,0.12)";
                    e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                    e.currentTarget.style.transform = "translateY(0px)";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "20px" }}>{peca.icone}</span>
                    <span style={{ fontSize: "12px", fontWeight: "900", color: "#fff" }}>
                      {peca.nome}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2px" }}>
                    <span style={{ fontSize: "10px", color: "#38bdf8", fontWeight: "800" }}>
                      Painel: R$ {peca.custoPainel.toLocaleString("pt-BR")}
                    </span>
                    <span style={{ fontSize: "12px", color: "#4ade80", fontWeight: "900" }}>
                      R$ {peca.valor.toLocaleString("pt-BR")}
                    </span>
                  </div>
                </button>
              ))}

              {pecasFiltradas.length === 0 && (
                <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "30px", color: theme?.subtext || "#9ca3af", fontSize: "13px" }}>
                  Nenhuma peça estética encontrada para os filtros selecionados.
                </div>
              )}
            </div>

            {/* Footer com Aviso de Trava Financeira */}
            <div
              style={{
                padding: "12px 20px",
                background: theme?.card2 || "#1f2937",
                borderTop: `1px solid ${theme?.border || "rgba(255,255,255,0.1)"}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "8px"
              }}
            >
              <div style={{ fontSize: "11px", color: theme?.subtext || "#9ca3af" }}>
                💡 <b>Trava Automática:</b> A peça será adicionada e a seleção será ajustada respeitando o teto de <b>R$ {custoPainel.toLocaleString("pt-BR")}</b> pago no painel.
              </div>
              <button
                type="button"
                onClick={() => setModalSeletorEstetico(false)}
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: `1px solid ${theme?.border || "rgba(255,255,255,0.2)"}`,
                  color: "#fff",
                  padding: "6px 14px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: "700",
                  cursor: "pointer"
                }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
