import { mkdir, rename, writeFile } from 'node:fs/promises';
import dns from 'node:dns';
import { setDefaultAutoSelectFamilyAttemptTimeout } from 'node:net';
import { domainToUnicode } from 'node:url';

dns.setDefaultResultOrder('ipv4first');
setDefaultAutoSelectFamilyAttemptTimeout(10000);

const IANA_URL = 'https://data.iana.org/TLD/tlds-alpha-by-domain.txt';
const PORKBUN_URL = 'https://api.porkbun.com/api/json/v3/pricing/get';

const POPULAR = new Set([
  'com', 'net', 'org', 'io', 'dev', 'app', 'ai', 'co', 'me', 'xyz',
  'info', 'biz', 'online', 'site', 'store', 'shop', 'tech', 'blog',
  'cloud', 'design', 'studio', 'agency', 'art', 'pro', 'page', 'wiki',
  'news', 'media', 'email', 'tv', 'cc', 'us', 'uk', 'de', 'ca', 'au',
  'eu', 'nl', 'fr', 'es', 'it', 'se', 'no', 'ch', 'jp', 'in', 'br',
  'nz', 'sg', 'ie', 'at', 'be', 'pl', 'pt', 'fi', 'dk', 'mx', 'kr',
  'hk', 'ly', 'to', 'fm', 'am', 'sh', 'so', 'gg', 'is', 'id', 'ph',
  'my', 'th', 'vn', 'za', 'ae', 'tr', 'cz', 'ro', 'hu',
]);

async function fetchText(url, accept) {
  const response = await fetch(url, {
    headers: {
      accept,
      'user-agent': 'tld-ltd-price-refresh',
    },
  });
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  const text = await response.text();
  if (!text.trim()) {
    throw new Error(`${url} returned an empty body`);
  }
  return text;
}

function parseIana(text) {
  const tlds = text
    .split(/\r?\n/)
    .map((line) => line.trim().toLowerCase())
    .filter((line) => line && !line.startsWith('#') && line !== '.');
  if (tlds.length === 0) {
    throw new Error('IANA list contained no TLDs');
  }
  return tlds;
}

function money(value, field, tld) {
  const normalized = String(value).replace(/,/g, '').trim();
  const amount = Number(normalized);
  if (!Number.isFinite(amount)) {
    throw new Error(`Bad ${field} for .${tld}: ${value}`);
  }
  return Math.round(amount * 100) / 100;
}

function kindOf(tld) {
  if (tld.startsWith('xn--')) return 'idn';
  if (tld.length === 2) return 'ccTLD';
  return 'generic';
}

function displayOf(tld) {
  try {
    const unicode = domainToUnicode(tld);
    return unicode || tld;
  } catch {
    return tld;
  }
}

const ianaText = await fetchText(IANA_URL, 'text/plain');
const porkbunText = await fetchText(PORKBUN_URL, 'application/json');

const iana = parseIana(ianaText);
const porkbun = JSON.parse(porkbunText);
if (porkbun.status !== 'SUCCESS' || !porkbun.pricing || typeof porkbun.pricing !== 'object') {
  throw new Error('Porkbun pricing response was not usable');
}

const priced = new Map();
for (const [name, raw] of Object.entries(porkbun.pricing)) {
  const tld = name.trim().toLowerCase().replace(/^\./, '');
  if (!tld) continue;
  priced.set(tld, {
    register: money(raw.registration, 'registration', tld),
    renew: money(raw.renewal, 'renewal', tld),
    transfer: money(raw.transfer, 'transfer', tld),
  });
}

if (priced.size === 0) {
  throw new Error('Porkbun returned no prices');
}

const names = new Set([...iana, ...priced.keys()]);
const tlds = [...names].sort().map((tld) => {
  const price = priced.get(tld) ?? null;
  return {
    tld,
    display: displayOf(tld),
    kind: kindOf(tld),
    popular: POPULAR.has(tld),
    prices: price ? { porkbun: price } : null,
  };
});

const catalog = {
  updatedAt: new Date().toISOString(),
  registrars: [
    {
      id: 'porkbun',
      name: 'Porkbun',
      buyUrl: 'https://porkbun.com/checkout/search?q={domain}',
    },
  ],
  tlds,
};

await mkdir('data', { recursive: true });
const tmp = 'data/prices.json.tmp';
await writeFile(tmp, `${JSON.stringify(catalog, null, 2)}\n`);
await rename(tmp, 'data/prices.json');

const withPrices = tlds.filter((entry) => entry.prices).length;
console.log(`Wrote ${tlds.length} TLDs (${withPrices} priced) to data/prices.json`);
