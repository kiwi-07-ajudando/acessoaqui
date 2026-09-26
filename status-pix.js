// netlify/functions/status-pix.js
// Consulta se um Pix já foi pago, usado pela página para atualizar o status automaticamente.

const API_BASE = 'https://api.syncpayments.com.br/api/partner/v1';
const API_BASE_V2 = 'https://api.syncpayments.com.br/api/partner/v2';

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
  cachedTokenExpiry = now + (Number(data.expires_in || 3600) - 60) * 1000;
  return cachedToken;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return resposta(405, { error: 'Método não permitido.' });
  }

  const identifier = event.queryStringParameters && event.queryStringParameters.id;
  if (!identifier) {
    return resposta(400, { error: 'Parâmetro "id" ausente.' });
  }

  try {
    const token = await getAccessToken();

    const res = await fetch(`${API_BASE_V2}/transactions/${encodeURIComponent(identifier)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await res.json();

    if (!res.ok) {
      return resposta(res.status, { error: data.message || 'Erro ao consultar a transação.' });
    }

    const status = data && data.data && data.data.transaction ? data.data.transaction.status : 'unknown';
    return resposta(200, { status });
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
