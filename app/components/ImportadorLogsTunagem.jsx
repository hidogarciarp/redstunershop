import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../utils/supabaseClient";
import { parseLogsTunagemTexto } from "../utils/calculadoraTunagem";

export default function ImportadorLogsTunagem({
  theme,
  styles,
  onImportacaoConcluida
}) {
  const [arquivoNome, setArquivoNome] = useState("");
  const [textoManual, setTextoManual] = useState("");
  const [logsIdentificados, setLogsIdentificados] = useState([]);
  const [estatisticas, setEstatisticas] = useState(null);
  const [processandoLeitura, setProcessandoLeitura] = useState(false);
  const [importandoBanco, setImportandoBanco] = useState(false);
  const [progresso, setProgresso] = useState({ atual: 0, total: 0, porcentagem: 0, status: "" });
  const [oficinaFallback, setOficinaFallback] = useState("RED'S TUNERSHOP");
  
  const [mecanicas, setMecanicas] = useState([]);
  const [vinculos, setVinculos] = useState([]);

  const fileInputRef = useRef(null);

  // Carrega lista de oficinas e vínculos de mecânicos
  useEffect(() => {
    async function carregarOficinasEVinculos() {
      try {
        const { data: mecs } = await supabase.from("mecanicas").select("*");
        if (mecs) setMecanicas(mecs);
        const { data: vincs } = await supabase.from("vinculos_mecanicas").select("*");
        if (vincs) setVinculos(vincs);
      } catch (err) {
        console.error("Erro ao carregar oficinas:", err);
      }
    }
    carregarOficinasEVinculos();
  }, []);

  // Helper para identificar a oficina de um log pelo técnico ou texto
  const identificarOficina = (logOficinaNome, tecId, dataLog) => {
    // 1. Se o log já tiver o nome da oficina explícito e válido no texto
    if (logOficinaNome && logOficinaNome.trim() !== "?" && logOficinaNome.trim() !== "") {
      const nomeLimpo = logOficinaNome.trim();
      const mecEncontrada = mecanicas.find((m) => m.nome.toLowerCase() === nomeLimpo.toLowerCase());
      if (mecEncontrada) return mecEncontrada.nome;
      return nomeLimpo;
    }

    // 2. Se for '?' ou vazio, busca pelo ID do técnico no quadro de vínculos
    if (tecId && vinculos.length > 0) {
      const vinc = vinculos.find((v) => 
        String(v.usuario_id) === String(tecId) && 
        (!v.data_fim || (dataLog && v.data_fim >= dataLog))
      );
      if (vinc) {
        const mec = mecanicas.find((m) => m.id === vinc.mecanica_id);
        if (mec) return mec.nome;
      }
    }

    // 3. Caso não encontre vínculo no banco, usa a oficina fallback
    return oficinaFallback || "Não Identificada";
  };

  // Processa o conteúdo bruto de texto ou objeto JSON
  const processarConteudo = (conteudoBruto, nomeOrigem = "Entrada manual") => {
    setProcessandoLeitura(true);
    setEstatisticas(null);

    try {
      let mensagensTexto = [];
      let totalMensagensBrutas = 0;

      // 1. Tenta interpretar como JSON
      try {
        const parsedJson = JSON.parse(conteudoBruto);

        if (parsedJson && typeof parsedJson === "object") {
          // Caso { filtro, quantidade, mensagens: [ { id, texto } ] }
          if (Array.isArray(parsedJson.mensagens)) {
            totalMensagensBrutas = parsedJson.mensagens.length;
            mensagensTexto = parsedJson.mensagens.map((m) => {
              if (typeof m === "string") return m;
              return m.texto || m.content || m.raw || "";
            });
          } else if (Array.isArray(parsedJson)) {
            totalMensagensBrutas = parsedJson.length;
            mensagensTexto = parsedJson.map((m) => {
              if (typeof m === "string") return m;
              return m.texto || m.content || m.raw || "";
            });
          } else {
            mensagensTexto = [JSON.stringify(parsedJson)];
          }
        }
      } catch (jsonErr) {
        // Se não for JSON válido, trata como texto puro
        mensagensTexto = [conteudoBruto];
        totalMensagensBrutas = 1;
      }

      // 2. Extrai os logs de tunagem de cada mensagem
      const mapaLogsPorUuid = new Map();

      for (const msgTexto of mensagensTexto) {
        if (!msgTexto || typeof msgTexto !== "string") continue;
        if (!msgTexto.includes("[TUNAGEM DE VEÍCULO]") && !msgTexto.includes("[TUNAGEM DE VEICULO]")) continue;

        const logsDaMensagem = parseLogsTunagemTexto(msgTexto);
        for (const log of logsDaMensagem) {
          if (log.uuid) {
            // Atribui a oficina correta com base no técnico ou nome original
            const oficinaResolvida = identificarOficina(log.oficina_nome, log.tecnico_id, log.data);
            log.oficina_nome = oficinaResolvida;
            
            if (!log.baia_nome || log.baia_nome === "?") {
              log.baia_nome = "Geral";
            }
            mapaLogsPorUuid.set(log.uuid, log);
          }
        }
      }

      const listaLogsUnicos = Array.from(mapaLogsPorUuid.values());

      if (listaLogsUnicos.length === 0) {
        alert("⚠️ Nenhum log válido de [TUNAGEM DE VEÍCULO] com UUID foi encontrado no arquivo fornecido.");
        setProcessandoLeitura(false);
        return;
      }

      // Ordenar do mais recente para o mais antigo
      listaLogsUnicos.sort((a, b) => {
        const dtA = `${a.data} ${a.hora || "00:00:00"}`;
        const dtB = `${b.data} ${b.hora || "00:00:00"}`;
        return dtB.localeCompare(dtA);
      });

      // 3. Calcula Estatísticas do Lote e Separação por Oficina
      const tecnicosSet = new Set();
      const veiculosSet = new Set();
      const distribuicaoOficinas = {};
      let totalValorPago = 0;
      let dataMaisAntiga = listaLogsUnicos[0].data;
      let dataMaisRecente = listaLogsUnicos[0].data;

      for (const log of listaLogsUnicos) {
        if (log.tecnico_nome) tecnicosSet.add(`${log.tecnico_nome} (ID: ${log.tecnico_id})`);
        if (log.veiculo_nome) veiculosSet.add(log.veiculo_nome);
        const valor = Number(log.valor_pago || 0);
        totalValorPago += valor;

        const ofc = log.oficina_nome || "Outras";
        if (!distribuicaoOficinas[ofc]) {
          distribuicaoOficinas[ofc] = { count: 0, totalValor: 0 };
        }
        distribuicaoOficinas[ofc].count += 1;
        distribuicaoOficinas[ofc].totalValor += valor;

        if (log.data < dataMaisAntiga) dataMaisAntiga = log.data;
        if (log.data > dataMaisRecente) dataMaisRecente = log.data;
      }

      setLogsIdentificados(listaLogsUnicos);
      setEstatisticas({
        nomeOrigem,
        totalMensagensLidas: totalMensagensBrutas || mensagensTexto.length,
        totalLogsUnicos: listaLogsUnicos.length,
        totalDuplicadasIgnoradas: Math.max(0, (totalMensagensBrutas || mensagensTexto.length) - listaLogsUnicos.length),
        tecnicos: Array.from(tecnicosSet),
        veiculosCount: veiculosSet.size,
        totalValorPago,
        distribuicaoOficinas,
        dataInicio: dataMaisAntiga,
        dataFim: dataMaisRecente
      });

    } catch (err) {
      console.error("Erro ao processar arquivo:", err);
      alert(`❌ Erro ao analisar o arquivo: ${err.message}`);
    } finally {
      setProcessandoLeitura(false);
    }
  };

  // Handler de upload de arquivo via input
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setArquivoNome(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === "string") {
        processarConteudo(content, file.name);
      }
    };
    reader.readAsText(file);
  };

  // Handler de arrastar e soltar (drag & drop)
  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    setArquivoNome(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === "string") {
        processarConteudo(content, file.name);
      }
    };
    reader.readAsText(file);
  };

  // Envia os logs tratados para o Supabase em lotes
  const executarImportacao = async () => {
    if (logsIdentificados.length === 0) return;
    if (importandoBanco) return;

    if (!confirm(`🚀 Deseja iniciar a importação de ${logsIdentificados.length} logs de tunagem para o banco de dados? Registros com o mesmo UUID serão atualizados sem duplicar.`)) {
      return;
    }

    setImportandoBanco(true);
    const total = logsIdentificados.length;
    const tamanhoLote = 50;
    let inseridosOuAtualizados = 0;
    let falhas = 0;

    try {
      for (let i = 0; i < total; i += tamanhoLote) {
        const lote = logsIdentificados.slice(i, i + tamanhoLote).map((log) => {
          const ofcLower = (log.oficina_nome || oficinaPadrao || "").toLowerCase();
          let mecId = "outras";
          if (ofcLower.includes("salt") || ofcLower.includes("dudark") || ofcLower.includes("lab")) {
            mecId = "dudark";
          } else if (ofcLower.includes("beach") || ofcLower.includes("vespucci")) {
            mecId = "vespucci";
          } else if (ofcLower.includes("harmony")) {
            mecId = "harmony";
          } else if (ofcLower.includes("red")) {
            mecId = "reds";
          }

          return {
            uuid: log.uuid,
            mechanic_id: mecId,
            oficina_nome: log.oficina_nome || oficinaPadrao,
            baia_nome: log.baia_nome || "Geral",
            tecnico_id: log.tecnico_id,
            tecnico_nome: log.tecnico_nome,
            dono_id: log.dono_id,
            dono_nome: log.dono_nome,
            veiculo_nome: log.veiculo_nome,
            veiculo_modelo: log.veiculo_modelo,
            placa: log.placa,
            valor_pago: log.valor_pago,
            antes_json: log.antes_json,
            depois_json: log.depois_json,
            data: log.data,
            hora: log.hora,
            raw_text: log.raw_text,
            cobrado: false,
            status: "pendente"
          };
        });

        const { error } = await supabase
          .from("logs_tunagem")
          .upsert(lote, { onConflict: "uuid" });

        // Upsert apenas para logs estritamente da RED'S na tabela logs_tunagem_reds
        const loteReds = lote.filter((l) => l.mechanic_id === "reds" && (l.oficina_nome || "").toLowerCase().includes("red"));
        if (loteReds.length > 0) {
          try {
            await supabase.from("logs_tunagem_reds").upsert(loteReds, { onConflict: "uuid" });
          } catch (errReds) {
            console.warn("Aviso ao sincronizar logs_tunagem_reds:", errReds);
          }
        }

        if (error) {
          console.error(`Erro no lote ${i} - ${i + tamanhoLote}:`, error);
          falhas += lote.length;
        } else {
          inseridosOuAtualizados += lote.length;
        }

        const progressoAtual = Math.min(i + tamanhoLote, total);
        const porcentagem = Math.round((progressoAtual / total) * 100);
        setProgresso({
          atual: progressoAtual,
          total,
          porcentagem,
          status: `Gravando no Supabase: ${progressoAtual} de ${total} logs (${porcentagem}%)...`
        });
      }

      setResultadoFinal({
        sucesso: true,
        totalProcessado: total,
        salvos: inseridosOuAtualizados,
        falhas
      });

      alert(`✅ Importação concluída com sucesso!\n\n${inseridosOuAtualizados} logs salvos/atualizados no banco de dados.`);

      if (onImportacaoConcluida) {
        onImportacaoConcluida();
      }
    } catch (e) {
      console.error("Erro geral na importação:", e);
      alert(`❌ Erro ao gravar dados no Supabase: ${e.message}`);
    } finally {
      setImportandoBanco(false);
    }
  };

  const limparTudo = () => {
    setArquivoNome("");
    setTextoManual("");
    setLogsIdentificados([]);
    setEstatisticas(null);
    setResultadoFinal(null);
    setProgresso({ atual: 0, total: 0, porcentagem: 0, status: "" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      
      {/* Header Informativo */}
      <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "16px", padding: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "900", color: "#10b981", display: "flex", alignItems: "center", gap: "10px" }}>
              📥 Importador Inteligente Multi-Oficinas (.JSON / Discord)
            </h3>
            <p style={{ margin: "6px 0 0", fontSize: "13px", color: theme.subtext }}>
              O importador analisa o <strong>ID de cada técnico</strong> para identificar automaticamente se o serviço pertence à <strong>RED'S, BENNY'S, EAST</strong> ou outras oficinas cadastradas.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <label style={{ fontSize: "12px", color: theme.subtext, fontWeight: "700" }}>Oficina Fallback (caso técnico não cadastrado):</label>
            <input
              value={oficinaFallback}
              onChange={(e) => setOficinaFallback(e.target.value)}
              placeholder="RED'S TUNERSHOP"
              style={{
                background: theme.card2,
                border: `1px solid ${theme.border}`,
                color: "#fff",
                padding: "6px 12px",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: "700"
              }}
            />
          </div>
        </div>
      </div>

      {/* Área de Seleção de Arquivo / Drag & Drop */}
      {!estatisticas && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          {/* Opção 1: Upload de Arquivo */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              background: theme.card,
              border: `2px dashed ${arquivoNome ? "#10b981" : theme.border}`,
              borderRadius: "16px",
              padding: "40px 20px",
              textAlign: "center",
              cursor: "pointer",
              transition: "all 0.2s ease",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px"
            }}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".json,.txt"
              style={{ display: "none" }}
            />
            <div style={{ fontSize: "42px" }}>📁</div>
            <h4 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#fff" }}>
              {arquivoNome ? arquivoNome : "Clique ou arraste o arquivo .JSON aqui"}
            </h4>
            <p style={{ margin: 0, fontSize: "12px", color: theme.subtext, maxWidth: "340px" }}>
              Suporta o formato nativo de exportação do canal do Discord com 1.000+ mensagens.
            </p>
            <button
              type="button"
              style={{
                background: "rgba(16,185,129,0.15)",
                border: "1px solid #10b981",
                color: "#34d399",
                padding: "8px 18px",
                borderRadius: "8px",
                fontWeight: "800",
                fontSize: "12px",
                marginTop: "8px"
              }}
            >
              Selecionar Arquivo .JSON
            </button>
          </div>

          {/* Opção 2: Colar Texto Manual */}
          <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "16px", padding: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: "#fff", display: "flex", alignItems: "center", gap: "8px" }}>
              📝 Ou Cole o JSON / Texto dos Logs
            </h4>
            <textarea
              rows={7}
              value={textoManual}
              onChange={(e) => setTextoManual(e.target.value)}
              placeholder="Cole aqui o conteúdo JSON ou a sequência de logs de tunagem copiados do Discord..."
              style={{
                flex: 1,
                width: "100%",
                background: theme.card2,
                border: `1px solid ${theme.border}`,
                color: "#fff",
                padding: "12px",
                borderRadius: "10px",
                fontSize: "12px",
                fontFamily: "monospace",
                outline: "none",
                resize: "none"
              }}
            />
            <button
              disabled={!textoManual.trim() || processandoLeitura}
              onClick={() => processarConteudo(textoManual, "Texto Colado Manualmente")}
              style={{
                background: textoManual.trim() ? "linear-gradient(135deg, #10b981 0%, #059669 100%)" : theme.card2,
                border: "none",
                color: "#fff",
                padding: "10px",
                borderRadius: "8px",
                fontWeight: "800",
                fontSize: "12px",
                cursor: textoManual.trim() ? "pointer" : "not-allowed",
                opacity: textoManual.trim() ? 1 : 0.6
              }}
            >
              {processandoLeitura ? "⏳ Analisando..." : "🔍 Analisar Conteúdo Colado"}
            </button>
          </div>
        </div>
      )}

      {/* Painel de Auditoria e Prévia antes de Salvar */}
      {estatisticas && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Card de Resumo das Estatísticas */}
          <div style={{ background: theme.card, border: "1px solid #10b981", borderRadius: "16px", padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px", marginBottom: "20px" }}>
              <div>
                <span style={{ background: "rgba(16,185,129,0.15)", color: "#34d399", padding: "4px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: "900" }}>
                  PRÉVIA DA ANÁLISE CONCLUÍDA
                </span>
                <h3 style={{ margin: "8px 0 0", fontSize: "20px", fontWeight: "900", color: "#fff" }}>
                  📄 {estatisticas.nomeOrigem}
                </h3>
                <p style={{ margin: "4px 0 0", fontSize: "13px", color: theme.subtext }}>
                  Período detectado: <strong>{estatisticas.dataInicio}</strong> até <strong>{estatisticas.dataFim}</strong>
                </p>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={limparTudo}
                  disabled={importandoBanco}
                  style={{
                    background: "rgba(239,68,68,0.15)",
                    border: "1px solid #ef4444",
                    color: "#f87171",
                    padding: "10px 18px",
                    borderRadius: "10px",
                    fontWeight: "800",
                    fontSize: "13px",
                    cursor: "pointer"
                  }}
                >
                  ✖ Cancelar / Outro Arquivo
                </button>

                <button
                  onClick={executarImportacao}
                  disabled={importandoBanco || logsIdentificados.length === 0}
                  style={{
                    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    border: "none",
                    color: "#fff",
                    padding: "10px 24px",
                    borderRadius: "10px",
                    fontWeight: "900",
                    fontSize: "13px",
                    cursor: importandoBanco ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    boxShadow: "0 4px 14px rgba(16,185,129,0.4)"
                  }}
                >
                  {importandoBanco ? "⏳ Gravando no Banco..." : `🚀 Salvar ${logsIdentificados.length} Logs no Supabase`}
                </button>
              </div>
            </div>

            {/* Barra de Progresso durante a gravação */}
            {importandoBanco && (
              <div style={{ marginBottom: "20px", background: theme.card2, border: `1px solid ${theme.border}`, borderRadius: "12px", padding: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "13px", fontWeight: "800", color: "#34d399" }}>
                  <span>{progresso.status}</span>
                  <span>{progresso.porcentagem}%</span>
                </div>
                <div style={{ width: "100%", height: "10px", background: "rgba(255,255,255,0.08)", borderRadius: "6px", overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${progresso.porcentagem}%`,
                      height: "100%",
                      background: "linear-gradient(90deg, #10b981 0%, #34d399 100%)",
                      transition: "width 0.2s ease"
                    }}
                  />
                </div>
              </div>
            )}

            {/* Grid com Métricas */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
              <div style={{ background: theme.card2, border: `1px solid ${theme.border}`, borderRadius: "12px", padding: "16px" }}>
                <span style={{ fontSize: "12px", color: theme.subtext, fontWeight: "700" }}>LOGS ÚNICOS EXTRAÍDOS</span>
                <div style={{ fontSize: "24px", fontWeight: "900", color: "#34d399", marginTop: "4px" }}>
                  {estatisticas.totalLogsUnicos}
                </div>
                <span style={{ fontSize: "11px", color: theme.subtext }}>
                  {estatisticas.totalDuplicadasIgnoradas > 0 ? `(${estatisticas.totalDuplicadasIgnoradas} duplicadas descartadas)` : "Nenhuma duplicada"}
                </span>
              </div>

              <div style={{ background: theme.card2, border: `1px solid ${theme.border}`, borderRadius: "12px", padding: "16px" }}>
                <span style={{ fontSize: "12px", color: theme.subtext, fontWeight: "700" }}>VALOR TOTAL IN-GAME</span>
                <div style={{ fontSize: "24px", fontWeight: "900", color: "#4ade80", marginTop: "4px" }}>
                  R$ {estatisticas.totalValorPago.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </div>
                <span style={{ fontSize: "11px", color: theme.subtext }}>Soma do custo das peças</span>
              </div>

              <div style={{ background: theme.card2, border: `1px solid ${theme.border}`, borderRadius: "12px", padding: "16px" }}>
                <span style={{ fontSize: "12px", color: theme.subtext, fontWeight: "700" }}>MECÂNICOS / TÉCNICOS</span>
                <div style={{ fontSize: "24px", fontWeight: "900", color: "#60a5fa", marginTop: "4px" }}>
                  {estatisticas.tecnicos.length}
                </div>
                <span style={{ fontSize: "11px", color: theme.subtext }}>identificados nos logs</span>
              </div>

              <div style={{ background: theme.card2, border: `1px solid ${theme.border}`, borderRadius: "12px", padding: "16px" }}>
                <span style={{ fontSize: "12px", color: theme.subtext, fontWeight: "700" }}>VEÍCULOS DIFERENTES</span>
                <div style={{ fontSize: "24px", fontWeight: "900", color: "#f59e0b", marginTop: "4px" }}>
                  {estatisticas.veiculosCount}
                </div>
                <span style={{ fontSize: "11px", color: theme.subtext }}>modelos modificados</span>
              </div>
            </div>

            {/* Divisão Identificada por Oficina */}
            {estatisticas.distribuicaoOficinas && Object.keys(estatisticas.distribuicaoOficinas).length > 0 && (
              <div style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${theme.border}`, borderRadius: "12px", padding: "16px" }}>
                <span style={{ fontSize: "12px", color: theme.subtext, fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  🏢 Divisão Automática por Oficina Detectada:
                </span>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "10px" }}>
                  {Object.entries(estatisticas.distribuicaoOficinas).map(([ofcNome, dados]) => (
                    <div key={ofcNome} style={{ background: theme.card2, border: `1px solid ${theme.border}`, borderRadius: "8px", padding: "10px 16px" }}>
                      <div style={{ fontSize: "13px", fontWeight: "900", color: "#fff" }}>
                        {ofcNome}
                      </div>
                      <div style={{ fontSize: "12px", color: "#34d399", fontWeight: "800", marginTop: "2px" }}>
                        {dados.count} serviços <span style={{ color: theme.subtext, fontWeight: "400" }}>(R$ {dados.totalValor.toLocaleString("pt-BR")})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Tabela de Amostra dos Logs Identificados */}
          <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "16px", padding: "20px", overflowX: "auto" }}>
            <h4 style={{ margin: "0 0 14px 0", fontSize: "15px", fontWeight: "800", color: "#fff", display: "flex", alignItems: "center", gap: "8px" }}>
              👀 Amostra dos Logs com Oficinas Atribuídas (Primeiros 10 de {logsIdentificados.length})
            </h4>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${theme.border}`, color: theme.subtext }}>
                  <th style={{ padding: "10px 12px" }}>Data / Hora</th>
                  <th style={{ padding: "10px 12px" }}>Oficina Atribuída</th>
                  <th style={{ padding: "10px 12px" }}>Técnico</th>
                  <th style={{ padding: "10px 12px" }}>Cliente</th>
                  <th style={{ padding: "10px 12px" }}>Veículo (Placa)</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>Valor In-Game</th>
                </tr>
              </thead>
              <tbody>
                {logsIdentificados.slice(0, 10).map((l) => (
                  <tr key={l.uuid} style={{ borderBottom: `1px solid ${theme.border}` }}>
                    <td style={{ padding: "10px 12px", color: "#fff", fontWeight: "700", whiteSpace: "nowrap" }}>
                      {l.data} <span style={{ color: theme.subtext, fontSize: "11px" }}>{l.hora}</span>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ background: "rgba(236,72,153,0.15)", border: "1px solid #ec4899", color: "#f472b6", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "800" }}>
                        {l.oficina_nome}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", color: "#60a5fa", fontWeight: "700" }}>
                      {l.tecnico_nome} <span style={{ color: theme.subtext, fontSize: "11px" }}>(ID: {l.tecnico_id})</span>
                    </td>
                    <td style={{ padding: "10px 12px", color: "#fff" }}>
                      {l.dono_nome || "N/A"} {l.dono_id && <span style={{ color: theme.subtext, fontSize: "11px" }}>(ID: {l.dono_id})</span>}
                    </td>
                    <td style={{ padding: "10px 12px", color: "#f59e0b", fontWeight: "700" }}>
                      {l.veiculo_nome} <span style={{ background: "rgba(255,255,255,0.08)", padding: "2px 6px", borderRadius: "4px", fontSize: "11px", color: "#fff", fontFamily: "monospace" }}>{l.placa}</span>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: "#4ade80", fontWeight: "800" }}>
                      R$ {Number(l.valor_pago || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
