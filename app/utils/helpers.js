import { CARGOS_HIERARQUIA } from "./constants";

export const getPrimaryRole = (role) => {
  if (!role) return "estagiario";
  return role.split("|")[0].toLowerCase().trim();
};

export const getAtribuicoes = (role) => {
  if (!role) return [];
  return role.split("|").slice(1);
};

export const getLabelCargo = (role) => {
  const primary = getPrimaryRole(role);
  const cargo = CARGOS_HIERARQUIA.find((c) => c.value === primary);
  let label = cargo ? cargo.label : primary;
  const atr = getAtribuicoes(role).filter((a) => a !== "dono_secundario");
  if (atr.length > 0) {
    const atrLabels = atr.map((a) => {
      if (a === "gerente_rh") return "💜 Gerente RH";
      if (a === "resp_rh") return "👥 Resp. RH";
      if (a === "resp_ponto") return "📌 Resp. Ponto";
      if (a === "resp_eventos") return "📅 Resp. Eventos";
      if (a === "resp_tunagem") return "🔧 Resp. Tunagem";
      if (a === "resp_parcerias") return "🤝 Resp. Parcerias";
      if (a === "resp_financas") return "💰 Resp. Finanças";
      return a;
    });
    label += " | " + atrLabels.join(", ");
  }
  return label;
};

export const getNivel = (role) => {
  const primary = getPrimaryRole(role);
  const cargo = CARGOS_HIERARQUIA.find((c) => c.value === primary);
  return cargo ? cargo.nivel : 0;
};

export const isAdminOuDono = (role) => {
  const primary = getPrimaryRole(role);
  return primary === "admin" || primary === "dono";
};

export const isResponsavelPonto = (role) => {
  const primary = getPrimaryRole(role);
  return isAdminOuDono(role) || primary === "gerente_geral" || getAtribuicoes(role).includes("resp_ponto");
};

export const podeNotificar = (roleRemetente, roleDestinatario) => {
  return getNivel(roleRemetente) > getNivel(roleDestinatario);
};

export const podeSendNotif = (role) => getNivel(role) >= 2;

export const podeEditarFuncionario = (editorRole, alvoRole) => {
  const editorPrimary = getPrimaryRole(editorRole);
  const editorAtr = getAtribuicoes(editorRole);
  const editorNivel = getNivel(editorRole);
  const alvoNivel = getNivel(alvoRole);
  if (editorPrimary === "admin" || editorPrimary === "dono") return true;
  const isRH = editorPrimary === "gerente_rh" || editorAtr.includes("gerente_rh") || editorAtr.includes("resp_rh");
  if ((editorPrimary === "gerente_geral" || isRH) && alvoNivel < 6) return true;
  if (editorPrimary === "gerente" && alvoNivel < 5) return true;
  return false;
};

export const formatarTelefone = (v) => {
  const digits = v.replace(/\D/g, "").slice(0, 6);
  if (digits.length <= 3) return digits;
  return digits.slice(0, 3) + "-" + digits.slice(3);
};