import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { copyPlain, copySecret } from '../../app/clipboard';
import { NAV_HEIGHT } from '../../app/TabLayout';
import { formStyles } from '../../components/form/Form';
import { CloseIcon, CloudIcon, CopyIcon, DownloadIcon, KeyIcon, LockIcon, PlusIcon, SearchIcon } from '../../components/icons';
import { useSnackbar, useSnackbarPlacement } from '../../components/Snackbar';
import { fold, hostOf, searchLogins, type Login } from '../../domain/logins';
import { useVault } from '../../vault/VaultProvider';
import t from '../shared/TabScreen.module.css';
import { listMemory } from './listMemory';
import s from './Logins.module.css';
import { SyncChip } from './SyncChip';

/** Letter group of a login: A–Z by the name without accents, everything else under "#". */
export function groupLetter(name: string): string {
  const first = fold(name).charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : '#';
}

export function groupLogins(logins: Login[]): { letter: string; logins: Login[] }[] {
  const groups: { letter: string; logins: Login[] }[] = [];
  for (const login of logins) {
    const letter = groupLetter(login.name);
    const last = groups[groups.length - 1];
    if (last && last.letter === letter) last.logins.push(login);
    else groups.push({ letter, logins: [login] });
  }
  return groups;
}

/** The name with the first matching search word emphasised (case-insensitive). */
function Highlighted({ name, query }: { name: string; query: string }) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const lower = name.toLowerCase();
  for (const word of words) {
    const at = lower.indexOf(word);
    if (at >= 0) {
      return (
        <>
          <span className={s.dim}>{name.slice(0, at)}</span>
          <span className={s.match}>{name.slice(at, at + word.length)}</span>
          <span className={s.dim}>{name.slice(at + word.length)}</span>
        </>
      );
    }
  }
  return <span className={s.dim}>{name}</span>;
}

function LoginRow({ login, query }: { login: Login; query: string }) {
  const snackbar = useSnackbar();
  const subtitle = login.username || hostOf(login.url) || login.url;

  async function copyUsername() {
    const ok = await copyPlain(login.username);
    snackbar.show(ok ? { message: `${login.name} username copied` } : { message: "Couldn't copy. Open the login instead.", icon: 'info' });
  }
  async function copyPassword() {
    const ok = await copySecret(login.password);
    snackbar.show(ok ? { message: `${login.name} password copied · clears in 30 s while PassMan is open` } : { message: "Couldn't copy. Open the login instead.", icon: 'info' });
  }

  return (
    <div className={s.row}>
      {login.username ? (
        <button type="button" className={s.rowButton} aria-label={`Copy ${login.name} username`} onClick={() => void copyUsername()}><CopyIcon /></button>
      ) : (
        <span className={s.rowSpacer} />
      )}
      <Link to={`/logins/${login.id}`} className={s.rowLink}>
        <span className={s.rowText}>
          <span className={s.rowName}>{query ? <Highlighted name={login.name} query={query} /> : login.name}</span>
          {subtitle && <span className={s.rowSub}>{subtitle}</span>}
        </span>
      </Link>
      <button type="button" className={s.rowButton} aria-label={`Copy ${login.name} password`} onClick={() => void copyPassword()}><KeyIcon /></button>
    </div>
  );
}

function LoginGroup({ logins, query = '' }: { logins: Login[]; query?: string }) {
  return (
    <div className={t.glass}>
      {logins.map((login, i) => (
        <div key={login.id}>
          {i > 0 && <div className={s.divider} />}
          <LoginRow login={login} query={query} />
        </div>
      ))}
    </div>
  );
}

/** Home of the app (brief 03): search, letter groups, copy straight from a row. */
export function LoginsPage() {
  const vault = useVault();
  const navigate = useNavigate();
  const [query, setQueryState] = useState(() => listMemory.query);
  const list = useRef<HTMLDivElement>(null);
  const setQuery = (q: string) => {
    listMemory.setQuery(q);
    setQueryState(q);
    if (list.current) list.current.scrollTop = 0;
  };
  const search = useRef<HTMLInputElement>(null);
  useSnackbarPlacement(NAV_HEIGHT + 12);

  // laptop: "/" focuses the search field
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.key === '/' && !(target && /^(INPUT|TEXTAREA)$/.test(target.tagName))) {
        e.preventDefault();
        search.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const logins = vault.logins;
  const results = useMemo(() => (query.trim() ? searchLogins(logins, query) : null), [logins, query]);
  const groups = useMemo(() => groupLogins(logins), [logins]);
  const empty = logins.length === 0;

  // back from a login: the list opens where it was
  useLayoutEffect(() => {
    if (list.current) list.current.scrollTop = listMemory.scrollTop;
  }, []);

  return (
    <div className={t.screen}>
      <header className={t.header}>
        <h1 className={t.title}>Logins</h1>
        <SyncChip />
        <button type="button" className={t.iconButton} aria-label="Lock now" onClick={() => vault.lock({ kind: 'manual' })}><LockIcon /></button>
      </header>

      {empty ? (
        <div className={s.emptyWrap}>
          <div className={`${t.glass} ${s.emptyCard}`}>
            <div className={s.emptyIcon}><KeyIcon size={28} /></div>
            <div className={s.emptyText}>
              <h2 className={s.emptyTitle}>Your vault is ready</h2>
              <p className={s.emptyLead}>Add logins one at a time, or bring them all over from Chrome in one go.</p>
            </div>
            <div className={s.emptyActions}>
              <button type="button" className={formStyles.primary} onClick={() => navigate('/logins/new')}>Add your first login</button>
              <button type="button" className={formStyles.secondary} onClick={() => navigate('/import')}>
                <DownloadIcon />Import from Chrome
              </button>
            </div>
          </div>
          <div className={`${formStyles.note} ${formStyles.noteInfo}`}>
            <span className={formStyles.noteIcon}><CloudIcon size={18} /></span>
            <span>Want these logins on your tablet and laptop too? <Link to="/settings" className={s.noteLink}>Connect Dropbox in Settings</Link></span>
          </div>
        </div>
      ) : (
        <>
          <div className={s.searchWrap}>
            <div className={`${s.search} ${query ? s.searchActive : ''}`}>
              <SearchIcon />
              <input
                ref={search}
                type="search"
                aria-label="Search logins"
                className={s.searchInput}
                placeholder={`Search ${logins.length} ${logins.length === 1 ? 'login' : 'logins'}`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setQuery('');
                }}
              />
              <span className={s.slashHint} aria-hidden="true">/</span>
              {query && (
                <button type="button" className={s.clear} aria-label="Clear search" onClick={() => { setQuery(''); search.current?.focus(); }}>
                  <CloseIcon size={18} />
                </button>
              )}
            </div>
          </div>
          <div ref={list} className={`${t.scroll} ${s.list}`} onScroll={(e) => listMemory.setScrollTop(e.currentTarget.scrollTop)}>
            {results ? (
              results.length ? (
                <>
                  <div className={s.count} role="status">{results.length} {results.length === 1 ? 'match' : 'matches'}</div>
                  <LoginGroup logins={results} query={query} />
                </>
              ) : (
                <div role="status" className={s.noResult}>
                  <div className={s.noResultText}>No login matches <i>{query.trim()}</i></div>
                  <button type="button" className={s.addNamed} onClick={() => navigate('/logins/new', { state: { name: query.trim() } })}>
                    <PlusIcon />Add &#8220;{query.trim()}&#8221;
                  </button>
                </div>
              )
            ) : (
              groups.map((group) => (
                <section key={group.letter} className={s.group}>
                  <div className={s.groupHeader}>
                    <h2 className={s.groupLetter}>{group.letter}</h2>
                    <span className={s.groupCount} aria-label={`${group.logins.length} logins`}>{group.logins.length}</span>
                  </div>
                  <LoginGroup logins={group.logins} />
                </section>
              ))
            )}
          </div>
          <button type="button" className={t.fab} onClick={() => navigate('/logins/new')}><PlusIcon size={22} />Add login</button>
        </>
      )}
    </div>
  );
}
