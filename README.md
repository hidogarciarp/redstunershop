# 🛠️ Sistema de Registro e Gestão - Red's Tunershop

Um ecossistema Full-Stack completo desenvolvido para a gestão eficiente de oficinas mecânicas em ambientes de RPG (FiveM) ou pequenas empresas de estética automotiva. O sistema automatiza desde o registro de ponto dos funcionários até o faturamento detalhado e auditoria de serviços.

![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

## 🌟 Destaques do Projeto

- **Dashboard Administrativo**: Visualização em tempo real do desempenho da equipe com gráficos interativos.
- **Gestão de Ponto (Ponto Eletrônico)**: Sistema de entrada e saída com cálculo automático de horas trabalhadas e ranking semanal.
- **Faturamento Automatizado**: Cálculo de preços baseado em tabelas dinâmicas (Tunagem, Estética, Reparos).
- **Integração com Discord**: Envio automático de comprovantes e logs via Webhooks para canais específicos.
- **Auditoria de Clientes**: Histórico completo de gastos por cliente e identificação de "Melhores Clientes".
- **Sistema de Missões**: Gamificação para funcionários com metas e recompensas.

## 🚀 Tecnologias Utilizadas

- **Frontend**: Next.js 14, React Hooks, Recharts (Gráficos).
- **Backend**: Supabase (PostgreSQL) para banco de dados e autenticação.
- **Estilização**: CSS dinâmico com suporte a Dark Mode.
- **Integrações**: Webhooks de Discord, OCR para leitura de imagens (prints de serviços).

## 📂 Estrutura de Documentação

Para entender a fundo como o sistema funciona tecnicamente, acesse:
👉 [**DOCUMENTATION.md](./DOCUMENTATION.md)** - Diagramas de arquitetura, fluxo de dados e modelo ER.

## 🛠️ Como rodar o projeto localmente

1. Clone o repositório:
   ```bash
   git clone https://github.com/SEU_USUARIO/registro-servicos.git
   ```
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Configure as variáveis de ambiente:
   Crie um arquivo `.env.local` e adicione suas chaves do Supabase e Webhooks do Discord.
4. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

---
Desenvolvido por **Garrido** | [LinkedIn](https://www.linkedin.com/in/SEU_LINK)
