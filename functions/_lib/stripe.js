// Minimal fetch-based Stripe REST API client for Cloudflare Pages Functions.
// No SDK dependency (this repo has no build step / package.json), and the
// Workers runtime already provides fetch + Web Crypto, which is all Stripe's
// plain REST API needs.

const STRIPE_API_BASE = 'https://api.stripe.com/v1';

// Stripe's API takes application/x-www-form-urlencoded bodies using its
// bracket notation for nested objects/arrays, e.g.
// line_items[0][price_data][currency]=jpy
function flatten(value, prefix, out) {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    value.forEach((v, i) => flatten(v, `${prefix}[${i}]`, out));
  } else if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      flatten(v, prefix ? `${prefix}[${k}]` : k, out);
    }
  } else {
    out.push(`${encodeURIComponent(prefix)}=${encodeURIComponent(String(value))}`);
  }
}

function toFormBody(params) {
  const out = [];
  flatten(params, '', out);
  return out.join('&');
}

async function stripeRequest(env, method, path, params) {
  if (!env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not configured');
  const headers = { Authorization: `Basic ${btoa(`${env.STRIPE_SECRET_KEY}:`)}` };
  let url = `${STRIPE_API_BASE}${path}`;
  let body;
  if (method === 'GET') {
    const qs = params ? toFormBody(params) : '';
    if (qs) url += `?${qs}`;
  } else {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = params ? toFormBody(params) : '';
  }
  const res = await fetch(url, { method, headers, body });
  const data = await res.json();
  if (!res.ok) {
    const message = (data && data.error && data.error.message) || `Stripe API error (${res.status})`;
    const err = new Error(message);
    err.stripeError = data && data.error;
    err.status = res.status;
    throw err;
  }
  return data;
}

export const stripe = {
  checkoutSessions: {
    create: (env, params) => stripeRequest(env, 'POST', '/checkout/sessions', params),
    retrieve: (env, id, params) => stripeRequest(env, 'GET', `/checkout/sessions/${id}`, params),
  },
  paymentIntents: {
    retrieve: (env, id, params) => stripeRequest(env, 'GET', `/payment_intents/${id}`, params),
  },
  accounts: {
    create: (env, params) => stripeRequest(env, 'POST', '/accounts', params),
    retrieve: (env, id) => stripeRequest(env, 'GET', `/accounts/${id}`),
  },
  accountLinks: {
    create: (env, params) => stripeRequest(env, 'POST', '/account_links', params),
  },
  transfers: {
    create: (env, params) => stripeRequest(env, 'POST', '/transfers', params),
  },
};

// Verifies a Stripe webhook signature using the Web Crypto API (no Node
// `crypto` module, which the Node SDK's `stripe.webhooks.constructEvent`
// relies on and which isn't available in the Workers runtime).
export async function verifyStripeSignature(payload, signatureHeader, secret) {
  if (!signatureHeader) throw new Error('Missing Stripe-Signature header');
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((kv) => {
      const [k, v] = kv.split('=');
      return [k.trim(), v];
    }),
  );
  const timestamp = parts.t;
  const expectedSig = parts.v1;
  if (!timestamp || !expectedSig) throw new Error('Malformed Stripe-Signature header');

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signedPayload = `${timestamp}.${payload}`;
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
  const computedSig = [...new Uint8Array(signatureBuffer)].map((b) => b.toString(16).padStart(2, '0')).join('');

  if (computedSig !== expectedSig) throw new Error('Stripe signature mismatch');

  // Stripe recommends rejecting events whose timestamp is too old, as a
  // replay-attack guard.
  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (ageSeconds > 300) throw new Error('Stripe webhook timestamp too old');
}
