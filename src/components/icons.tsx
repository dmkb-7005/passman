/** Inline stroke icons, drawn as in the PassMan design canvases (24×24 grid, 2 px stroke, currentColor). */
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size: number, rest: SVGProps<SVGSVGElement>) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...rest,
});

// navigation and structure
export const BackIcon = ({ size = 22, ...r }: P) => <svg {...base(size, r)}><path d="M15 18l-6-6 6-6" /></svg>;
export const ChevronRight = ({ size = 20, ...r }: P) => <svg {...base(size, r)}><path d="M9 6l6 6-6 6" /></svg>;
export const CloseIcon = ({ size = 20, ...r }: P) => <svg {...base(size, r)}><path d="M18 6L6 18M6 6l12 12" /></svg>;
export const PlusIcon = ({ size = 20, ...r }: P) => <svg {...base(size, r)}><path d="M12 5v14M5 12h14" /></svg>;
export const MinusIcon = ({ size = 20, ...r }: P) => <svg {...base(size, r)}><path d="M5 12h14" /></svg>;
export const SearchIcon = ({ size = 20, ...r }: P) => <svg {...base(size, r)}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>;
export const ExternalIcon = ({ size = 16, ...r }: P) => (
  <svg {...base(size, r)}><path d="M14 4h6v6" /><path d="M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
);

// tabs
export const KeyIcon = ({ size = 20, ...r }: P) => (
  <svg {...base(size, r)}><circle cx="7.5" cy="15.5" r="4.5" /><path d="M10.7 12.3L20 3" /><path d="M16.5 6.5l3 3" /><path d="M14 9l2.5 2.5" /></svg>
);
export const DiceIcon = ({ size = 20, ...r }: P) => (
  <svg {...base(size, r)}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
    {[[8.5, 8.5], [15.5, 8.5], [12, 12], [8.5, 15.5], [15.5, 15.5]].map(([cx, cy]) => (
      <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.2" fill="currentColor" stroke="none" />
    ))}
  </svg>
);
export const GearIcon = ({ size = 20, ...r }: P) => (
  <svg {...base(size, r)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

// actions
export const CopyIcon = ({ size = 20, ...r }: P) => (
  <svg {...base(size, r)}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" /></svg>
);
export const EyeIcon = ({ size = 22, ...r }: P) => (
  <svg {...base(size, r)}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
);
export const EyeOffIcon = ({ size = 22, ...r }: P) => (
  <svg {...base(size, r)}>
    <path d="M3 3l18 18" /><path d="M10.6 5.1A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2" />
    <path d="M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7c1.8 0 3.4-.5 4.8-1.3" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </svg>
);
export const LockIcon = ({ size = 22, ...r }: P) => (
  <svg {...base(size, r)}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
);
export const PrintIcon = ({ size = 20, ...r }: P) => (
  <svg {...base(size, r)}><path d="M6 9V3h12v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M6 14h12v7H6z" /></svg>
);
export const RefreshIcon = ({ size = 20, ...r }: P) => (
  <svg {...base(size, r)}><path d="M20 11a8 8 0 0 0-14.9-3" /><path d="M4 4v4h4" /><path d="M4 13a8 8 0 0 0 14.9 3" /><path d="M20 20v-4h-4" /></svg>
);
export const DownloadIcon = ({ size = 20, ...r }: P) => (
  <svg {...base(size, r)}><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>
);
export const RestoreIcon = ({ size = 20, ...r }: P) => <svg {...base(size, r)}><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></svg>;
export const UploadIcon = ({ size = 20, ...r }: P) => (
  <svg {...base(size, r)}><path d="M12 21V9" /><path d="M7 14l5-5 5 5" /><path d="M4 7V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2" /></svg>
);

// status
export const CheckIcon = ({ size = 16, ...r }: P) => <svg {...base(size, r)}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
export const RingIcon = ({ size = 16, ...r }: P) => <svg {...base(size, r)}><circle cx="12" cy="12" r="8" /></svg>;
export const AlertIcon = ({ size = 16, ...r }: P) => (
  <svg {...base(size, r)}><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5" /><path d="M12 16.5h.01" /></svg>
);
export const InfoIcon = ({ size = 18, ...r }: P) => (
  <svg {...base(size, r)}><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5" /><path d="M12 7.5h.01" /></svg>
);
export const WarnIcon = ({ size = 18, ...r }: P) => (
  <svg {...base(size, r)}><path d="M12 3.5L2.5 20h19L12 3.5z" /><path d="M12 10v4.5" /><path d="M12 17.5h.01" /></svg>
);
export const CloudIcon = ({ size = 20, ...r }: P) => <svg {...base(size, r)}><path d="M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6 9.5 4.25 4.25 0 0 0 7 18z" /></svg>;
export const CloudCheckIcon = ({ size = 16, ...r }: P) => (
  <svg {...base(size, r)}><path d="M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6 9.5 4.25 4.25 0 0 0 7 18z" /><path d="M9.5 13.8l1.8 1.8 3.4-3.4" /></svg>
);
export const CloudOffIcon = ({ size = 16, ...r }: P) => (
  <svg {...base(size, r)}><path d="M3 3l18 18" /><path d="M9.5 6.2A6 6 0 0 1 17.5 10a4 4 0 0 1 2.7 6.6" /><path d="M17 18H7a4.25 4.25 0 0 1-1-8.5 6 6 0 0 1 .8-2" /></svg>
);

// settings rows
export const ArchiveIcon = ({ size = 20, ...r }: P) => (
  <svg {...base(size, r)}><rect x="3" y="4" width="18" height="5" rx="1.5" /><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9" /><path d="M10 13h4" /></svg>
);
export const TimerIcon = ({ size = 22, ...r }: P) => (
  <svg {...base(size, r)}><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2" /><path d="M9.5 2.5h5" /></svg>
);
export const MoonIcon = ({ size = 22, ...r }: P) => <svg {...base(size, r)}><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /></svg>;
export const PasswordIcon = ({ size = 22, ...r }: P) => (
  <svg {...base(size, r)}><rect x="3" y="8" width="18" height="10" rx="3" /><path d="M7.5 13h.01M12 13h.01M16.5 13h.01" /></svg>
);
export const RecoveryKeyIcon = ({ size = 22, ...r }: P) => (
  <svg {...base(size, r)}><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M7 10h4M7 14h10M14 10h3" /></svg>
);
export const StorageIcon = ({ size = 22, ...r }: P) => (
  <svg {...base(size, r)}>
    <path d="M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3z" /><path d="M4 7v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7" /><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
  </svg>
);

// import (brief 09)
export const FileIcon = ({ size = 20, ...r }: P) => (
  <svg {...base(size, r)}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></svg>
);
export const DeviceIcon = ({ size = 18, ...r }: P) => (
  <svg {...base(size, r)}><rect x="7" y="2.5" width="10" height="19" rx="2" /><path d="M11 18.5h2" /></svg>
);
export const NotEqualIcon = ({ size = 14, ...r }: P) => (
  <svg {...base(size, r)}><path d="M5 9h14M5 15h14M15.5 5l-7 14" /></svg>
);
