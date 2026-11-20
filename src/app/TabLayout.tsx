import { useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { DiceIcon, GearIcon, KeyIcon } from '../components/icons';
import { NightRidges } from '../components/NightRidges';
import styles from './TabLayout.module.css';

/** `end: false` keeps a tab active on its subpages (e.g. /settings/password). */
const TABS = [
  { to: '/', label: 'Logins', icon: KeyIcon, end: true },
  { to: '/generator', label: 'Generator', icon: DiceIcon, end: true },
  { to: '/settings', label: 'Settings', icon: GearIcon, end: false },
] as const;

/** Height of the bottom navigation without the safe area (64 px items + 16 px below). */
export const NAV_HEIGHT = 80;

/**
 * Tab screens share the night-ridges background and the navigation: a bottom bar on phones and tablets in
 * portrait, a left rail from 900 px wide (laptop), with the content in a centred 560 px column.
 */
export function TabLayout() {
  // tells the snackbar (rendered outside this layout) that the laptop rail takes the left 88 px
  useEffect(() => {
    document.documentElement.dataset.rail = '';
    return () => {
      delete document.documentElement.dataset.rail;
    };
  }, []);
  return (
    <div className={styles.shell}>
      <NightRidges />
      <div className={styles.main}>
        <Outlet />
      </div>
      <nav className={styles.nav} aria-label="Main">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={styles.navItem}>
            <span className={styles.navIcon}><Icon /></span>
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
