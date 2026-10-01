export type Kind = 'generic' | 'ccTLD' | 'idn';

export type Price = {
  register: number;
  renew: number;
  transfer: number;
};

export type TldEntry = {
  tld: string;
  display: string;
  kind: Kind;
  popular: boolean;
  prices: Record<string, Price> | null;
};

export type Registrar = {
  id: string;
  name: string;
  buyUrl: string;
};

export type Catalog = {
  updatedAt: string;
  registrars: Registrar[];
  tlds: TldEntry[];
};

export type KindFilter = 'popular' | 'all' | Kind;
export type SortKey = 'renew' | 'register' | 'name';

export type ExplorerState = {
  q: string;
  kind: KindFilter;
  sort: SortKey;
  priced: boolean;
};

export const DEFAULT_STATE: ExplorerState = {
  q: '',
  kind: 'popular',
  sort: 'renew',
  priced: true,
};

export const KIND_LABEL: Record<Kind, string> = {
  generic: 'Generic',
  ccTLD: 'Country',
  idn: 'IDN',
};

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

export function formatMoney(amount: number) {
  return money.format(amount);
}

export function formatPrice(amount: number) {
  if (amount === 0) return 'Free';
  return formatMoney(amount);
}

export function formatUpdated(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function renewalGap(price: Price) {
  const gap = Math.round((price.renew - price.register) * 100) / 100;
  return gap > 0 ? gap : null;
}

export type Offer = {
  registrar: Registrar;
  price: Price;
};

export function offersFor(entry: TldEntry, registrars: Registrar[]): Offer[] {
  if (!entry.prices) return [];
  return registrars.flatMap((registrar) => {
    const price = entry.prices?.[registrar.id];
    return price ? [{ registrar, price }] : [];
  });
}

export function leadOffer(offers: Offer[]) {
  return offers.reduce((best, offer) => (offer.price.renew < best.price.renew ? offer : best));
}

export function sanitizeLabel(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 63);
}

export function domainFor(label: string, tld: string) {
  const cleaned = label.replace(/^-+/, '').replace(/-+$/, '');
  return `${cleaned || 'myname'}.${tld}`;
}

export function buyHref(template: string, domain: string) {
  return template.replaceAll('{domain}', encodeURIComponent(domain));
}

const KINDS = new Set<KindFilter>(['popular', 'all', 'generic', 'ccTLD', 'idn']);
const SORTS = new Set<SortKey>(['renew', 'register', 'name']);

export function readState(search: string): ExplorerState {
  const params = new URLSearchParams(search);
  const kind = params.get('kind');
  const sort = params.get('sort');
  return {
    q: (params.get('q') ?? '').trim().toLowerCase(),
    kind: kind && KINDS.has(kind as KindFilter) ? (kind as KindFilter) : DEFAULT_STATE.kind,
    sort: sort && SORTS.has(sort as SortKey) ? (sort as SortKey) : DEFAULT_STATE.sort,
    priced: params.get('priced') !== '0',
  };
}

export function hrefFor(state: ExplorerState) {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.kind !== DEFAULT_STATE.kind) params.set('kind', state.kind);
  if (state.sort !== DEFAULT_STATE.sort) params.set('sort', state.sort);
  if (!state.priced) params.set('priced', '0');
  const qs = params.toString();
  return qs ? `?${qs}` : window.location.pathname;
}
