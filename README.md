# Gerador de Pix — SyncPay + Netlify

Gera Pix Copia e Cola + QR Code para 3 valores fixos: **R$ 16,90 / R$ 21,90 / R$ 29,90**.

## Por que não é "um arquivo só"

A SyncPay exige um `client_secret` para autenticar. Esse segredo **nunca pode
aparecer no HTML/JS que roda no navegador** (qualquer visitante poderia abrir
o "Inspecionar" do navegador e roubá-lo). Por isso o projeto tem:

- `public/index.html` → a página que o cliente vê (não tem nenhuma senha nela).
- `netlify/functions/*.js` → código que roda escondido no servidor da Netlify,
  é o único lugar que fala com a SyncPay usando suas credenciais.

Mesmo assim, o deploy continua sendo "arrastar uma pasta e pronto".

## Passo a passo

### 1. Pegue suas credenciais na SyncPay
No painel da SyncPay, gere/copie:
- `client_id`
- `client_secret` (só aparece uma vez na criação — guarde em local seguro)

### 2. Suba este projeto para o Netlify

**Opção mais simples (drag and drop):**
1. Acesse https://app.netlify.com → **Add new site** → **Deploy manually**.
2. Arraste a pasta inteira `pix-syncpay` (com `netlify.toml`, `public/` e
   `netlify/` juntos) para a área de upload.

**Opção recomendada (via GitHub, permite atualizar depois):**
1. Crie um repositório no GitHub e suba estes arquivos.
2. No Netlify: **Add new site** → **Import an existing project** → conecte o
   repositório. O Netlify detecta o `netlify.toml` automaticamente.

### 3. Configure as variáveis de ambiente (obrigatório)
No painel do site no Netlify: **Site configuration → Environment variables**
→ adicione:

| Nome | Valor |
|---|---|
| `SYNCPAY_CLIENT_ID` | seu client_id da SyncPay |
| `SYNCPAY_CLIENT_SECRET` | seu client_secret da SyncPay |

Depois clique em **Deploys → Trigger deploy** para aplicar.

### 4. Pronto
Abra a URL do site — o cliente escolhe o valor, preenche nome e CPF, clica em
**Gerar Pix** e recebe o QR Code + o código Copia e Cola. A página consulta
automaticamente a cada 5 segundos se o pagamento já caiu.

## Testando localmente (opcional)
Se tiver o [Netlify CLI](https://docs.netlify.com/cli/get-started/) instalado:

```bash
npm install -g netlify-cli
netlify dev
```

Crie um arquivo `.env` na raiz com `SYNCPAY_CLIENT_ID` e
`SYNCPAY_CLIENT_SECRET` para testar localmente (não suba esse arquivo pro
GitHub).

## Sobre o nome/CPF pedidos no formulário
A SyncPay exige um `client` (nome e CPF, no mínimo) em cada cobrança Pix —
não tem como gerar um Pix anônimo pela API. Por isso a página pede esses
dados antes de gerar o código.

## Arquivos
```
pix-syncpay/
├── netlify.toml
├── public/
│   └── index.html
└── netlify/
    └── functions/
        ├── gerar-pix.js
        └── status-pix.js
```
