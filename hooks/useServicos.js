"use client";

import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { TABELA_PRECOS, REGRAS_PRECOS } from "@/app/utils/constants";
import { useToast } from "@/lib/toast";

export function useServicos(usuarioLogado) {
  const { toast } = useToast();
  const [cliente, setCliente] = useState("");
  const [passaporte, setPassaporte] = useState("");
  const [nomeMecanico, setNomeMecanico] = useState("");
  const [autorizadoPor, setAutorizadoPor] = useState("");
  const [gastoCliente, setGastoCliente] = useState(0);
  const [valorDigitadoEstetica, setValorDigitadoEstetica] = useState(0);
  const [arquivoImagem, setArquivoImagem] = useState(null);
  const [imagemPreview, setImagemPreview] = useState(null);
  const [arquivoImagem2, setArquivoImagem2] = useState(null);
  const [imagemPreview2, setImagemPreview2] = useState(null);
  const [servicosSelecionados, setServicosSelecionados] = useState({});
  const [camaleao1, setCamaleao1] = useState(false);
  const [camaleao2, setCamaleao2] = useState(false);
  const [camaleaoRodas, setCamaleaoRodas] = useState(false);
  const [quantidadeExtras, setQuantidadeExtras] = useState(0);
  const [fumaca, setFumaca] = useState(false);
  const [kmGuincho, setKmGuincho] = useState(0);
  const [qtdReparos, setQtdReparos] = useState(0);
  const [qtdPneus, setQtdPneus] = useState(0);
  const [semRodaImportada, setSemRodaImportada] = useState(false);
  const [nomeVeiculoRoda, setNomeVeiculoRoda] = useState("");
  const [imagemRoda, setImagemRoda] = useState(null);
  const [previewRoda, setPreviewRoda] = useState(null);
  const [reportBugs, setReportBugs] = useState(false);
  const [nomeVeiculoBugs, setNomeVeiculoBugs] = useState("");
  const [descricaoBug, setDescricaoBug] = useState("");
  const [imagemBugs, setImagemBugs] = useState(null);
  const [previewBugs, setPreviewBugs] = useState(null);

  const WEBHOOK_ESTETICA = "/api/discord?tipo=estetica";
  const WEBHOOK_TUNAGEM = "/api/discord?tipo=tunagem";
  const WEBHOOK_VENDAS = "/api/discord?tipo=vendas";
  const WEBHOOK_GUINCHO = "/api/discord?tipo=guincho";
  const WEBHOOK_RODAS = "/api/discord?tipo=rodas";
  const WEBHOOK_REPORT = "/api/discord?tipo=report";
  const WEBHOOK_PAGAMENTOS = "/api/discord?tipo=pagamentos";
  const WEBHOOK_CAIXA2 = "/api/discord?tipo=caixa2";

  const buscarCliente = useCallback(async (id) => {
    if (!id) { setCliente(""); setGastoCliente(0); return; }
    const { data } = await supabase.from("clientes").select("*").eq("id", Number(id)).maybeSingle();
    if (data) { setCliente(data.nome); setGastoCliente(data.total_gasto || 0); }
    else { setCliente(""); setGastoCliente(0); }
  }, []);

  const calcularTotal = useCallback(() => {
    let total = 0;
    for (const chave of Object.keys(servicosSelecionados)) {
      for (const cat of Object.keys(TABELA_PRECOS)) {
        const item = TABELA_PRECOS[cat].find((i) => i.id === chave);
        if (item) total += item.preco;
      }
    }
    const regra = REGRAS_PRECOS.guincho;
    total += (kmGuincho || 0) * regra.valor_km;
    total += (qtdReparos || 0) * regra.valor_reparo;
    total += (qtdPneus || 0) * regra.valor_pneu;

    const valEst = valorDigitadoEstetica || 0;
    total += valEst > 0 ? valEst : 0;
    total += (quantidadeExtras || 0) * REGRAS_PRECOS.estetica.valor_cliente_extra;
    if (fumaca) total += REGRAS_PRECOS.estetica.valor_cliente_fumaca;
    if (camaleao1 || camaleao2) total += REGRAS_PRECOS.estetica.valor_cliente_camaleao;
    if (camaleaoRodas) total += REGRAS_PRECOS.estetica.valor_cliente_camaleao;
    return total;
  }, [servicosSelecionados, kmGuincho, qtdReparos, qtdPneus, valorDigitadoEstetica, quantidadeExtras, fumaca, camaleao1, camaleao2, camaleaoRodas]);

  const limparFormulario = useCallback(() => {
    setCliente("");
    setPassaporte("");
    setAutorizadoPor("");
    setValorDigitadoEstetica(0);
    setArquivoImagem(null);
    setImagemPreview(null);
    setArquivoImagem2(null);
    setImagemPreview2(null);
    setServicosSelecionados({});
    setCamaleao1(false);
    setCamaleao2(false);
    setCamaleaoRodas(false);
    setQuantidadeExtras(0);
    setFumaca(false);
    setKmGuincho(0);
    setQtdReparos(0);
    setQtdPneus(0);
  }, []);

  const enviarParaDiscord = useCallback(async (tipo, webhookUrl, payloadExtra = {}) => {
    if (!webhookUrl) {
      toast("Webhook não configurado", "error");
      return;
    }
    const total = calcularTotal();
    const servicosStr = Object.keys(servicosSelecionados).map((chave) => {
      for (const cat of Object.keys(TABELA_PRECOS)) {
        const item = TABELA_PRECOS[cat].find((i) => i.id === chave);
        if (item) return `${item.nome}`;
      }
      return chave;
    }).join(", ");

    const embed = {
      embeds: [{
        title: `🛞 ${tipo} - Registro de Serviço`,
        color: 0x8b181e,
        fields: [
          { name: "👤 Cliente", value: `\`${cliente}\` (${passaporte})`, inline: true },
          { name: "🔧 Mecânico", value: usuarioLogado?.nome || nomeMecanico, inline: true },
          { name: "📋 Serviços", value: servicosStr || "Estética personalizada", inline: false },
          { name: "💵 Total", value: `R$ ${total.toLocaleString("pt-BR")}`, inline: true },
          ...(autorizadoPor ? [{ name: "✅ Autorizado por", value: autorizadoPor, inline: true }] : []),
        ],
        footer: { text: `ID do cliente: ${passaporte}` },
        timestamp: new Date().toISOString(),
      }],
    };

    if (arquivoImagem) {
      embed.embeds[0].image = { url: await blobToDataUri(arquivoImagem) };
    }

    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        body: JSON.stringify({ ...embed, ...payloadExtra }),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast(`✅ ${tipo} enviado com sucesso!`, "success");
    } catch (err) {
      toast(`Erro ao enviar ${tipo}: ${err.message}`, "error");
    }
  }, [calcularTotal, servicosSelecionados, cliente, passaporte, nomeMecanico, autorizadoPor, arquivoImagem, usuarioLogado, toast]);

  return {
    cliente, setCliente, passaporte, setPassaporte,
    nomeMecanico, setNomeMecanico, autorizadoPor, setAutorizadoPor,
    gastoCliente, setGastoCliente, valorDigitadoEstetica, setValorDigitadoEstetica,
    arquivoImagem, setArquivoImagem, imagemPreview, setImagemPreview,
    arquivoImagem2, setArquivoImagem2, imagemPreview2, setImagemPreview2,
    servicosSelecionados, setServicosSelecionados,
    camaleao1, setCamaleao1, camaleao2, setCamaleao2,
    camaleaoRodas, setCamaleaoRodas, quantidadeExtras, setQuantidadeExtras,
    fumaca, setFumaca, kmGuincho, setKmGuincho,
    qtdReparos, setQtdReparos, qtdPneus, setQtdPneus,
    semRodaImportada, setSemRodaImportada,
    nomeVeiculoRoda, setNomeVeiculoRoda, imagemRoda, setImagemRoda, previewRoda, setPreviewRoda,
    reportBugs, setReportBugs, nomeVeiculoBugs, setNomeVeiculoBugs,
    descricaoBug, setDescricaoBug, imagemBugs, setImagemBugs, previewBugs, setPreviewBugs,
    buscarCliente, calcularTotal, limparFormulario, enviarParaDiscord,
    WEBHOOK_ESTETICA, WEBHOOK_TUNAGEM, WEBHOOK_VENDAS, WEBHOOK_GUINCHO,
    WEBHOOK_RODAS, WEBHOOK_REPORT, WEBHOOK_PAGAMENTOS, WEBHOOK_CAIXA2,
  };
}

async function blobToDataUri(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}
