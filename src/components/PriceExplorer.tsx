import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  KIND_LABEL,
  buyHref,
  domainFor,
  formatPrice,
  formatUpdated,
  hrefFor,
  leadOffer,
  offersFor,
  readState,
  renewalGap,
  sanitizeLabel,
  type Catalog,
  type ExplorerState,
  type KindFilter,
  type SortKey,
  type TldEntry,
} from '../lib/catalog';

const SEGMENTS: { id: KindFilter; label: string }[] = [
  { id: 'popular', label: 'Popular' },
  { id: 'all', label: 'All' },
  { id: 'generic', label: 'Generic' },
  { id: 'ccTLD', label: 'Country' },
  { id: 'idn', label: 'IDN' },
];

const SORTS: { id: SortKey; label: string }[] = [
  { id: 'renew', label: 'Renewal' },
  { id: 'register', label: 'Register' },
  { id: 'name', label: 'Name' },
];

function sameState(a: ExplorerState, b: ExplorerState) {
  return a.q === b.q && a.kind === b.kind && a.sort === b.sort && a.priced === b.priced;
}

export default function PriceExplorer({ catalog }: { catalog: Catalog }) {
  const [state, setState] = useState<ExplorerState>({
    q: '',
    kind: 'popular',
    sort: 'renew',
    priced: true,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [label, setLabel] = useState('myname');
  const [theme, setTheme] = useState<'light' | 'dark' | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fromUrl = readState(window.location.search);
    setState((current) => (sameState(current, fromUrl) ? current : fromUrl));
    setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');

    const onPop = () => {
      setState(readState(window.location.search));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const dialog = dialogRef.current;
    const previously = document.activeElement as HTMLElement | null;
    const focusable = () =>
      [...(dialog?.querySelectorAll<HTMLElement>('a, button, input') ?? [])].filter(
        (el) => !el.hasAttribute('disabled'),
      );

    focusable()[0]?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedId(null);
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previously?.focus();
    };
  }, [selectedId]);

  const commit = (next: ExplorerState, mode: 'push' | 'replace') => {
    if (sameState(state, next)) return;
    setState(next);
    const url = hrefFor(next);
    if (mode === 'push') history.pushState(null, '', url);
    else history.replaceState(null, '', url);
  };

  const rows = useMemo(() => {
    const query = state.q.trim().replace(/^\./, '');
    const filtered = catalog.tlds.filter((entry) => {
      if (state.priced && !entry.prices) return false;
      if (state.kind === 'popular' && !entry.popular) return false;
      if (state.kind !== 'popular' && state.kind !== 'all' && entry.kind !== state.kind) return false;
      if (!query) return true;
      return entry.tld.includes(query) || entry.display.toLowerCase().includes(query);
    });

    const decorated = filtered.map((entry) => {
      const offers = offersFor(entry, catalog.registrars);
      return { entry, offer: offers.length ? leadOffer(offers) : null };
    });

    decorated.sort((a, b) => {
      if (state.sort === 'name') return a.entry.display.localeCompare(b.entry.display);
      const key = state.sort;
      const av = a.offer ? a.offer.price[key] : Number.POSITIVE_INFINITY;
      const bv = b.offer ? b.offer.price[key] : Number.POSITIVE_INFINITY;
      if (av !== bv) return av - bv;
      return a.entry.tld.localeCompare(b.entry.tld);
    });

    return decorated;
  }, [catalog, state]);

  const lowestRenew = useMemo(() => {
    let lowest = Number.POSITIVE_INFINITY;
    for (const row of rows) {
      if (row.offer && row.offer.price.renew < lowest) lowest = row.offer.price.renew;
    }
    return lowest;
  }, [rows]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 96,
    overscan: 8,
    getItemKey: (index) => rows[index]?.entry.tld ?? index,
  });

  const selected = catalog.tlds.find((entry) => entry.tld === selectedId) ?? null;
  const selectedOffers = selected ? offersFor(selected, catalog.registrars) : [];
  const source = catalog.registrars.map((registrar) => registrar.name).join(', ');

  const open = (tld: string) => {
    setLabel('myname');
    setSelectedId(tld);
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.classList.toggle('dark', next === 'dark');
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
    localStorage.setItem('theme', next);
    const themeColor = document.querySelector('meta[name="theme-color"]');
    themeColor?.setAttribute('content', next === 'dark' ? '#12110f' : '#f6f3ee');
    setTheme(next);
  };

  const previewName = selected ? domainFor(label, selected.display) : '';
  const checkoutName = selected ? domainFor(label, selected.tld) : '';

  return (
    <>
      <div className="shell" inert={selected ? true : undefined}>
        <header className="frame">
          <div className="topbar">
            <a className="wordmark" href="/">
              <span className="wordmark-tld">tld</span>
              <span className="wordmark-ltd">ltd</span>
            </a>
            <p className="updated">
              Prices from {source} · updated {formatUpdated(catalog.updatedAt)}
            </p>
            <button
              type="button"
              className="theme-btn"
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              onClick={toggleTheme}
            >
              <ThemeIcon mode={theme} />
            </button>
          </div>
          <div className="search-wrap">
            <label className="sr-only" htmlFor="tld-search">
              Search extensions
            </label>
            <input
              id="tld-search"
              className="search"
              value={state.q}
              placeholder="Search extensions — dev, .io, ai"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="search"
              onChange={(event) => {
                commit({ ...state, q: event.target.value.trimStart().toLowerCase() }, 'replace');
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape' && state.q) {
                  event.preventDefault();
                  commit({ ...state, q: '' }, 'replace');
                }
              }}
            />
          </div>
          <div className="controls">
            <div className="segments" role="radiogroup" aria-label="Extension group">
              {SEGMENTS.map((segment) => (
                <button
                  key={segment.id}
                  type="button"
                  className="segment"
                  role="radio"
                  aria-checked={state.kind === segment.id}
                  onClick={() => commit({ ...state, kind: segment.id }, 'push')}
                >
                  {segment.label}
                </button>
              ))}
            </div>
            <div className="segments" role="group" aria-label="Sort">
              {SORTS.map((sort) => (
                <button
                  key={sort.id}
                  type="button"
                  className="sort-btn"
                  aria-pressed={state.sort === sort.id}
                  onClick={() => commit({ ...state, sort: sort.id }, 'push')}
                >
                  {sort.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="priced-btn"
              aria-pressed={state.priced}
              onClick={() => commit({ ...state, priced: !state.priced }, 'push')}
            >
              With prices
            </button>
            <p className="count" aria-live="polite">
              {rows.length.toLocaleString('en-US')} {rows.length === 1 ? 'extension' : 'extensions'}
            </p>
          </div>
          <p className="note">
            Standard prices in USD. A renewal higher than the first year is marked, because that is the price you keep paying.
          </p>
        </header>

        <div className="flex min-h-0 flex-1 flex-col" role={rows.length ? 'table' : undefined} aria-label="Domain extensions" aria-rowcount={rows.length || undefined}>
          {rows.length > 0 ? (
            <div className="colhead frame" role="row">
              <span>Extension</span>
              <span>Type</span>
              <span>Register</span>
              <span>Renew</span>
              <span>Transfer</span>
            </div>
          ) : null}
          <div id="extensions" className="list" ref={listRef} role={rows.length ? 'rowgroup' : undefined}>
          {rows.length === 0 ? (
            <div className="empty">
              <p>No extensions match.</p>
              <button
                type="button"
                className="priced-btn"
                onClick={() => commit({ q: '', kind: 'all', sort: 'renew', priced: true }, 'push')}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <>
              <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
                {virtualizer.getVirtualItems().map((item) => {
                  const row = rows[item.index];
                  if (!row) return null;
                  return (
                    <div
                      key={row.entry.tld}
                      data-index={item.index}
                      ref={virtualizer.measureElement}
                      className="absolute left-0 top-0 w-full"
                      style={{ transform: `translateY(${item.start}px)` }}
                    >
                      <ExtensionRow
                        entry={row.entry}
                        price={row.offer?.price ?? null}
                        lowest={row.offer?.price.renew === lowestRenew}
                        onOpen={() => open(row.entry.tld)}
                      />
                    </div>
                  );
                })}
              </div>
            </>
          )}
          </div>
        </div>
      </div>

      {selected ? (
        <>
          <button type="button" className="backdrop" aria-label="Close details" onClick={() => setSelectedId(null)} />
          <div
            ref={dialogRef}
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sheet-title"
          >
            <div className="topbar" style={{ padding: 0 }}>
              <p className="sheet-kicker">{KIND_LABEL[selected.kind]}</p>
              <button type="button" className="close-btn" onClick={() => setSelectedId(null)}>
                Close
              </button>
            </div>
            <h2 id="sheet-title">.{selected.display}</h2>
            {selectedOffers.length === 0 ? (
              <>
                <p className="fine">Porkbun does not list a standard price for this extension.</p>
                {catalog.registrars[0] ? (
                  <a
                    className="buy"
                    href={buyHref(catalog.registrars[0].buyUrl, checkoutName)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Check on {catalog.registrars[0].name}
                  </a>
                ) : null}
              </>
            ) : (
              <>
                {selectedOffers.map((offer) => {
                  const gap = renewalGap(offer.price);
                  return (
                    <section key={offer.registrar.id}>
                      <p className="sheet-kicker">{offer.registrar.name}</p>
                      {gap ? (
                        <p className="sheet-warning">
                          Renewal is {formatPrice(gap)} more than the first year.
                        </p>
                      ) : (
                        <p className="fine">Registration and renewal are the same price.</p>
                      )}
                      <dl className="stats">
                        <div>
                          <dt>Register</dt>
                          <dd>{formatPrice(offer.price.register)}</dd>
                        </div>
                        <div>
                          <dt>Renew</dt>
                          <dd>{formatPrice(offer.price.renew)}</dd>
                        </div>
                        <div>
                          <dt>Transfer</dt>
                          <dd>{formatPrice(offer.price.transfer)}</dd>
                        </div>
                      </dl>
                    </section>
                  );
                })}
                <label className="field">
                  <span>Name</span>
                  <input
                    value={label}
                    autoComplete="off"
                    spellCheck={false}
                    autoCapitalize="none"
                    onChange={(event) => setLabel(sanitizeLabel(event.target.value))}
                  />
                </label>
                <p className="preview">{previewName}</p>
                {selectedOffers.map((offer) => (
                  <a
                    key={offer.registrar.id}
                    className="buy"
                    href={buyHref(offer.registrar.buyUrl, checkoutName)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Check on {offer.registrar.name}
                  </a>
                ))}
              </>
            )}
            <p className="fine">
              Standard list price in USD. Premium names can cost more, and the registrar confirms the live price at checkout.
            </p>
          </div>
        </>
      ) : null}
    </>
  );
}

function ExtensionRow({
  entry,
  price,
  lowest,
  onOpen,
}: {
  entry: TldEntry;
  price: { register: number; renew: number; transfer: number } | null;
  lowest: boolean;
  onOpen: () => void;
}) {
  const gap = price ? renewalGap(price) : null;
  const label = price
    ? `.${entry.display}, ${KIND_LABEL[entry.kind]}, register ${formatPrice(price.register)}, renew ${formatPrice(price.renew)}, transfer ${formatPrice(price.transfer)}`
    : `.${entry.display}, ${KIND_LABEL[entry.kind]}, no standard price`;

  return (
    <div className="row frame" role="row">
      <div className="cell-ext" aria-hidden="true">
        <span className="ext">
          <span className="dot">.</span>
          {entry.display}
        </span>
      </div>
      <div className="cell-kind kind" aria-hidden="true">
        {KIND_LABEL[entry.kind]}
      </div>
      <PriceCell label="Register" amount={price?.register ?? null} />
      <PriceCell label="Renew" amount={price?.renew ?? null} lowest={lowest} gap={gap} />
      <PriceCell label="Transfer" amount={price?.transfer ?? null} />
      <button type="button" className="hit" aria-label={label} aria-haspopup="dialog" onClick={onOpen} />
    </div>
  );
}

function PriceCell({
  label,
  amount,
  lowest = false,
  gap = null,
}: {
  label: string;
  amount: number | null;
  lowest?: boolean;
  gap?: number | null;
}) {
  const area = label === 'Register' ? 'cell-reg' : label === 'Renew' ? 'cell-renew' : 'cell-xfer';
  return (
    <div className={area} aria-hidden="true">
      <span className="price-label">{label}</span>
      {amount == null ? (
        <span className="missing">—</span>
      ) : (
        <span className={lowest ? 'price is-low' : 'price'}>
          {formatPrice(amount)}
          {lowest ? <span className="sr-only">, lowest renewal</span> : null}
        </span>
      )}
      {gap ? <span className="delta">+{formatPrice(gap)}</span> : null}
    </div>
  );
}

function ThemeIcon({ mode }: { mode: 'light' | 'dark' | null }) {
  if (mode === 'dark') {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <circle cx="9" cy="9" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.4 3.4l1.4 1.4M13.2 13.2l1.4 1.4M14.6 3.4l-1.4 1.4M4.8 13.2l-1.4 1.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M10.2 2.2a6.2 6.2 0 1 0 5.6 9.2 5.2 5.2 0 0 1-5.6-9.2Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
