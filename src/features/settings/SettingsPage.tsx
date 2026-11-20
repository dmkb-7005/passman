import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BUILD_INFO, buildLinks, shortCommit } from '../../app/buildInfo';
import { displayDateTime } from '../../app/format';
import { NAV_HEIGHT } from '../../app/TabLayout';
import { useUpdates } from '../../app/UpdateProvider';
import { BottomSheet } from '../../components/BottomSheet';
import { formStyles } from '../../components/form/Form';
import {
  AlertIcon,
  ArchiveIcon,
  CheckIcon,
  ChevronRight,
  CloudIcon,
  DownloadIcon,
  ExternalIcon,
  LockIcon,
  MoonIcon,
  PasswordIcon,
  RecoveryKeyIcon,
  RefreshIcon,
  RestoreIcon,
  StorageIcon,
  TimerIcon,
  WarnIcon,
} from '../../components/icons';
import { useSnackbar, useSnackbarPlacement } from '../../components/Snackbar';
import { updateSettings, useMeta, useSettings } from '../../db/meta';
import { backupStatus, daysAgo } from '../../domain/backupStatus';
import { useVault } from '../../vault/VaultProvider';
import t from '../shared/TabScreen.module.css';
import s from './Settings.module.css';

const IDLE_OPTIONS = [1, 2, 5, 10, 30];
const BACKGROUND_OPTIONS = [0, 30, 60, 300];
const minutes = (n: number) => `${n} ${n === 1 ? 'minute' : 'minutes'}`;
const backgroundLabel = (sec: number) => (sec === 0 ? 'Immediately' : sec < 60 ? `${sec} seconds` : minutes(sec / 60));
const backgroundValue = (sec: number) => (sec === 0 ? 'immediately' : `after ${backgroundLabel(sec)}`);

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className={s.section}>
      <h2 className={s.sectionLabel}>{label}</h2>
      {children}
    </section>
  );
}

function Row({ icon, label, sub, value, to, onClick, accent }: { icon: ReactNode; label: string; sub?: string; value?: string; to?: string; onClick?: () => void; accent?: boolean }) {
  const content = (
    <>
      <span className={`${s.rowIcon} ${accent ? s.accent : ''}`}>{icon}</span>
      <span className={s.rowText}>
        <span className={`${s.rowLabel} ${accent ? s.rowLabelAccent : ''}`}>{label}</span>
        {sub && <span className={s.rowSub}>{sub}</span>}
      </span>
      {value && <span className={s.rowValue}>{value}</span>}
      {!accent && <span className={s.chevron}><ChevronRight /></span>}
    </>
  );
  return to ? <Link to={to} className={s.row}>{content}</Link> : <button type="button" className={s.row} onClick={onClick}>{content}</button>;
}

function OptionSheet<T extends number>({ title, intro, options, label, value, onPick, onClose }: { title: string; intro: string; options: T[]; label: (v: T) => string; value: T; onPick: (v: T) => void; onClose: () => void }) {
  return (
    <BottomSheet title={title} onClose={onClose}>
      <p className={s.sheetIntro}>{intro}</p>
      <div role="radiogroup" aria-label={title} className={s.radios}>
        {options.map((option) => (
          <button key={option} type="button" role="radio" aria-checked={option === value} className={`${s.radio} ${option === value ? s.radioOn : ''}`} onClick={() => onPick(option)}>
            <span aria-hidden="true" className={s.radioMark}>{option === value && <span className={s.radioDot} />}</span>
            {label(option)}
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}

/** Settings (brief 07). Dropbox, backup and import arrive in later milestones; their rows say so. */
export function SettingsPage() {
  const vault = useVault();
  const snackbar = useSnackbar();
  const updates = useUpdates();
  const settings = useSettings();
  const lastBackupAt = useMeta<string>('lastBackupAt');
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [sheet, setSheet] = useState<'idle' | 'background' | null>(null);
  const [scrolled, setScrolled] = useState(false);
  useSnackbarPlacement(NAV_HEIGHT + 12);

  useEffect(() => {
    void navigator.storage?.persisted?.().then(setPersisted, () => setPersisted(null));
  }, []);

  const later = (what: string) => snackbar.show({ message: `${what} arrives in the next version of PassMan.`, icon: 'info' });

  async function requestPersistence() {
    const granted = (await navigator.storage?.persist?.().catch(() => false)) ?? false;
    setPersisted(granted);
    snackbar.show(granted ? { message: 'Persistent storage granted' } : { message: 'The browser did not grant persistent storage', icon: 'info' });
  }

  async function checkForUpdates() {
    setChecking(true);
    const result = await updates.check();
    setChecking(false);
    if (result === 'none') snackbar.show({ message: "You're up to date" });
    if (result === 'unavailable') snackbar.show({ message: 'Update check unavailable (offline or not installed yet)', icon: 'info' });
  }

  if (!settings) return null;
  const backup = backupStatus(lastBackupAt ?? null, settings.backupReminderDays ?? Number.POSITIVE_INFINITY);
  const links = buildLinks(BUILD_INFO);
  const deployed = Number.isNaN(Date.parse(BUILD_INFO.deployedAt)) ? BUILD_INFO.deployedAt : displayDateTime(BUILD_INFO.deployedAt);

  return (
    <div className={t.screen}>
      <header className={`${t.header} ${s.header} ${scrolled ? s.headerScrolled : ''}`}><h1 className={t.title}>Settings</h1></header>
      <div className={`${t.scroll} ${s.body}`} onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 4)}>
        <Section label="Sync">
          <div className={`${t.glass} ${s.card}`}>
            <div className={s.cardHead}>
              <span className={s.circle}><CloudIcon /></span>
              <div className={s.cardTitles}>
                <span className={s.cardTitle}>Dropbox</span>
                <span className={s.cardSub}>Not connected</span>
              </div>
            </div>
            <p className={s.cardText}>Sync this vault between your phone, tablet and laptop. PassMan only sees its own folder in your Dropbox, and everything in it is encrypted.</p>
            <button type="button" className={formStyles.primary} onClick={() => later('Dropbox sync')}>Connect Dropbox</button>
          </div>
        </Section>

        <Section label="Backup">
          <div className={`${t.glass} ${s.card}`}>
            <div className={s.cardHead}>
              {backup.state === 'never' ? (
                <span className={`${s.circle} ${s.circleDanger}`}><AlertIcon size={20} /></span>
              ) : backup.state === 'overdue' ? (
                <span className={`${s.circle} ${s.circleWarn}`}><WarnIcon size={20} /></span>
              ) : (
                <span className={s.circle}><ArchiveIcon /></span>
              )}
              <div className={s.cardTitles}>
                {backup.state === 'never' ? (
                  <>
                    <span className={`${s.cardTitle} ${s.danger}`}>Never backed up</span>
                    <span className={s.cardSub}>Export a backup and keep it somewhere safe.</span>
                  </>
                ) : (
                  <>
                    <span className={`${s.cardTitle} ${backup.state === 'overdue' ? s.warn : ''}`}>{backup.state === 'overdue' ? `Backup overdue · ${daysAgo(backup.days)}` : `Last backup ${daysAgo(backup.days)}`}</span>
                    <span className={s.cardSub}>{lastBackupAt ? displayDateTime(lastBackupAt, false) : ''}</span>
                  </>
                )}
              </div>
            </div>
            <div className={s.buttons}>
              <button type="button" className={formStyles.primary} onClick={() => later('Exporting a backup')}>Export backup</button>
              <button type="button" className={formStyles.secondary} onClick={() => later('Restoring a backup')}><RestoreIcon />Restore from backup</button>
            </div>
            <p className={s.hint}>The backup file is encrypted. It opens with your master password or recovery key.</p>
          </div>
        </Section>

        <Section label="Import">
          <div className={`${t.glass} ${s.group}`}>
            <Row icon={<DownloadIcon size={22} />} label="Import from Chrome" sub="From Chrome’s password export file" onClick={() => later('Importing from Chrome')} />
          </div>
        </Section>

        <Section label="Security">
          <div className={`${t.glass} ${s.group}`}>
            <Row icon={<TimerIcon />} label="Auto-lock after inactivity" value={minutes(settings.lockIdleMinutes)} onClick={() => setSheet('idle')} />
            <div className={s.divider} />
            <Row icon={<MoonIcon />} label="Lock when in background" value={backgroundValue(settings.lockBackgroundSeconds)} onClick={() => setSheet('background')} />
            <div className={s.divider} />
            <Row icon={<PasswordIcon />} label="Change master password" to="/settings/password" />
            <div className={s.divider} />
            <Row icon={<RecoveryKeyIcon />} label="New recovery key" to="/settings/recovery-key" />
            <div className={s.divider} />
            <Row icon={<LockIcon />} label="Lock now" accent onClick={() => vault.lock({ kind: 'manual' })} />
          </div>
        </Section>

        <Section label="Storage">
          <div className={`${t.glass} ${s.storage}`}>
            <span className={s.rowIcon}><StorageIcon /></span>
            <div className={s.storageText}>
              <span className={s.storageTitle}>Persistent storage</span>
              <span className={s.rowSub}>The browser won&#8217;t clear PassMan&#8217;s data to free up space.</span>
              {persisted === false && <button type="button" className={`${formStyles.secondary} ${s.requestButton}`} onClick={() => void requestPersistence()}>Request persistent storage</button>}
            </div>
            {persisted === true && <span className={`${s.badge} ${s.badgeOk}`}><CheckIcon size={14} />Granted</span>}
            {persisted === false && <span className={`${s.badge} ${s.badgeWarn}`}><WarnIcon size={14} />Not granted</span>}
          </div>
        </Section>

        <Section label="About this version">
          <div className={`${t.glass} ${s.about}`}>
            <div className={s.kv}><span className={s.k}>Version</span><span className={`${s.v} ${s.num}`}>{BUILD_INFO.version}</span></div>
            <div className={s.kv}><span className={s.k}>Commit</span><span className={s.v}><span className={s.num}>{shortCommit(BUILD_INFO.commit)}</span>{BUILD_INFO.commitMessage ? ` · ${BUILD_INFO.commitMessage}` : ''}</span></div>
            <div className={s.kv}><span className={s.k}>Deployed</span><span className={s.v}>{deployed}</span></div>
            <div className={s.kv}><span className={s.k}>By</span><span className={s.v}>{BUILD_INFO.deployedBy}</span></div>
            {(links.commitUrl || links.runUrl) && (
              <div className={s.links}>
                {links.commitUrl && <a href={links.commitUrl} target="_blank" rel="noreferrer">View commit<ExternalIcon /></a>}
                {links.runUrl && <a href={links.runUrl} target="_blank" rel="noreferrer">View deploy run<ExternalIcon /></a>}
              </div>
            )}
            <button type="button" className={`${formStyles.secondary} ${s.updateButton}`} disabled={checking} onClick={() => void checkForUpdates()}>
              <RefreshIcon />{checking ? 'Checking…' : 'Check for updates'}
            </button>
          </div>
        </Section>
      </div>

      {sheet === 'idle' && (
        <OptionSheet
          title="Auto-lock after inactivity"
          intro="PassMan locks when you haven’t used it for this long."
          options={IDLE_OPTIONS}
          label={minutes}
          value={settings.lockIdleMinutes}
          onClose={() => setSheet(null)}
          onPick={(v) => {
            void updateSettings({ lockIdleMinutes: v });
            setSheet(null);
            snackbar.show({ message: `Auto-lock set to ${minutes(v)}` });
          }}
        />
      )}
      {sheet === 'background' && (
        <OptionSheet
          title="Lock when in background"
          intro="PassMan locks when it has been in the background for this long."
          options={BACKGROUND_OPTIONS}
          label={backgroundLabel}
          value={settings.lockBackgroundSeconds}
          onClose={() => setSheet(null)}
          onPick={(v) => {
            void updateSettings({ lockBackgroundSeconds: v });
            setSheet(null);
            snackbar.show({ message: `Locks ${backgroundValue(v)} in the background` });
          }}
        />
      )}
    </div>
  );
}
