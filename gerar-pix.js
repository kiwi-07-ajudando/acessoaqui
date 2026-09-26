// netlify/functions/gerar-pix.js
// Roda no servidor da Netlify. O client_id/client_secret NUNCA chegam ao navegador.

const API_BASE = 'https://api.syncpayments.com.br/api/partner/v1';

// Valores permitidos (mesma regra validada aqui no servidor, nunca confie só no front-end)
const VALORES_PERMITIDOS = [16.90, 21.90, 29.90];

// Cache simples em memória: evita gerar um token novo a cada requisição
// (o token dura 1 hora — a doc da SyncPay pede para reaproveitar).
let cachedToken = null;
let cachedTokenExpiry = 0;

async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && now < cachedTokenExpiry) {
    return cachedToken;
  }

  const clientId = process.env.SYNCPAY_CLIENT_ID;
  const clientSecret = process.env.SYNCPAY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('SYNCPAY_CLIENT_ID / SYNCPAY_CLIENT_SECRET não configurados nas variáveis de ambiente da Netlify.');
  }

  const res = await fetch(`${API_BASE}/auth-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret })
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error_description || data.message || 'Falha ao autenticar na SyncPay.');
  }

  cachedToken = data.access_token;
  // renova um pouco antes de expirar, por segurança
  cachedTokenExpiry = now + (Number(data.expires_in || 3600) - 60) * 1000;
  return cachedToken;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return resposta(405, { error: 'Método não permitido.' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return resposta(400, { error: 'JSON inválido.' });
  }

  const amount = Number(body.amount);
  const amountValido = VALORES_PERMITIDOS.some(v => Math.abs(v - amount) < 0.001);
  if (!amountValido) {
    return resposta(422, { error: 'Valor não permitido. Escolha R$ 16,90, R$ 21,90 ou R$ 29,90.' });
  }

  const client = body.client || {};
  const nome = (client.name || '').trim();
  const cpf = (client.cpf || '').replace(/\D/g, '');
  const email = (client.email || '').trim();

  if (!nome) return resposta(422, { error: 'Nome é obrigatório.' });
  if (cpf.length !== 11) return resposta(422, { error: 'CPF inválido.' });

  try {
    const token = await getAccessToken();

    const payload = {
      amount,
      description: body.description || 'Pagamento via Pix',
      client: {
        name: nome,
        cpf,
        ...(email ? { email } : {}),
      }
    };

    const res = await fetch(`${API_BASE}/cash-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
      return resposta(res.status, { error: data.message || 'Erro ao gerar o Pix na SyncPay.', details: data.errors || null });
    }

    return resposta(200, {
      pix_code: data.pix_code,
      identifier: data.identifier
    });
  } catch (err) {
    return resposta(500, { error: err.message });
  }
};

function resposta(statusCode, obj) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(obj)
  };
}
