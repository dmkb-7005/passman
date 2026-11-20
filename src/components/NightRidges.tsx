import styles from './NightRidges.module.css';

/*
 * "Night ridges" background from the design canvases: gradient sky, a few stars, three mountain layers.
 * Phone drawing up to 899 px wide, the wide drawing (anchored to the bottom) from 900 px.
 */

type Star = readonly [number, number, number, number];

const PHONE_STARS: Star[] = [
  [173, 97, 1.2, 0.25], [45, 294, 0.7, 0.45], [306, 49, 0.8, 0.25], [52, 242, 1.2, 0.25], [131, 66, 1.2, 0.25], [297, 83, 0.8, 0.25],
  [303, 319, 1.2, 0.25], [121, 43, 0.8, 0.45], [222, 93, 0.7, 0.45], [294, 369, 0.8, 0.25], [305, 312, 0.8, 0.45], [57, 300, 0.7, 0.25],
];
const WELCOME_STARS: Star[] = [
  [34, 62, 1, 0.5], [92, 128, 0.8, 0.35], [148, 40, 1.2, 0.45], [226, 96, 0.8, 0.4], [300, 54, 1, 0.55], [356, 150, 0.9, 0.35],
  [62, 230, 0.8, 0.3], [330, 260, 1, 0.4], [190, 190, 0.7, 0.3], [268, 318, 0.8, 0.25], [18, 360, 0.7, 0.25], [376, 396, 0.8, 0.25],
];
const WIDE_STARS: Star[] = [
  [671, 97, 1.2, 0.45], [106, 57, 0.7, 0.35], [1201, 49, 0.8, 0.25], [184, 242, 1.2, 0.25], [500, 66, 1.2, 0.25], [1166, 83, 0.8, 0.45],
  [460, 43, 0.8, 0.35], [866, 93, 0.7, 0.45], [639, 306, 0.8, 0.25], [1199, 312, 0.8, 0.35], [207, 300, 0.7, 0.45], [130, 336, 0.8, 0.35],
  [1096, 238, 1, 0.35], [1207, 252, 1, 0.35], [516, 112, 0.8, 0.25], [1184, 173, 1.2, 0.35], [927, 167, 0.7, 0.25], [1056, 234, 0.8, 0.35],
  [319, 270, 1.2, 0.25], [166, 305, 1, 0.35], [725, 324, 1.2, 0.45], [942, 55, 0.7, 0.35], [978, 360, 0.7, 0.25], [642, 351, 1.2, 0.35],
  [798, 197, 0.7, 0.35], [735, 106, 0.7, 0.35], [128, 131, 1, 0.25], [515, 223, 1.2, 0.35], [173, 105, 1.2, 0.35], [1133, 162, 0.8, 0.35],
  [787, 138, 0.8, 0.25], [368, 97, 0.8, 0.45],
];

const PHONE_RIDGES = [
  'M0 523 L0 499 L65 555 L130 483 L195 547 L260 491 L325 563 L390 499 L390 844 L0 844 Z',
  'M0 591 L0 573 L49 621 L98 567 L146 609 L195 561 L244 615 L292 573 L341 621 L390 567 L390 844 L0 844 Z',
  'M0 658 L0 645 L39 676 L78 636 L117 672 L156 641 L195 680 L234 645 L273 676 L312 636 L351 672 L390 641 L390 844 L0 844 Z',
];
const WELCOME_RIDGES = [
  'M0 560 L60 500 L110 540 L180 452 L250 528 L310 476 L390 540 L390 844 L0 844 Z',
  'M0 620 L70 566 L130 604 L200 540 L270 600 L340 556 L390 590 L390 844 L0 844 Z',
  'M0 680 L50 650 L120 676 L190 628 L260 670 L320 642 L390 668 L390 844 L0 844 Z',
];
const WIDE_RIDGES = [
  'M0 496 L0 472 L107 528 L213 456 L320 520 L427 464 L533 536 L640 472 L747 528 L853 456 L960 520 L1067 464 L1173 536 L1280 472 L1280 800 L0 800 Z',
  'M0 560 L0 542 L91 590 L183 536 L274 578 L366 530 L457 584 L549 542 L640 590 L731 536 L823 578 L914 530 L1006 584 L1097 542 L1189 590 L1280 536 L1280 800 L0 800 Z',
  'M0 624 L0 611 L80 642 L160 602 L240 637 L320 606 L400 646 L480 611 L560 642 L640 602 L720 637 L800 606 L880 646 L960 611 L1040 642 L1120 602 L1200 637 L1280 606 L1280 800 L0 800 Z',
];
const FILLS = [['#3D9BFF', 0.07], ['#8A8CF2', 0.08], ['#141925', 0.9]] as const;

function Drawing({ width, height, stars, ridges, className }: { width: number; height: number; stars: Star[]; ridges: string[]; className?: string }) {
  return (
    <svg className={className} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMax slice">
      {stars.map(([cx, cy, r, o]) => <circle key={`${cx}-${cy}-${r}`} cx={cx} cy={cy} r={r} fill="#E6EAF2" opacity={o} />)}
      {ridges.map((d, i) => <path key={d} d={d} fill={FILLS[i]![0]} opacity={FILLS[i]![1]} />)}
    </svg>
  );
}

/** Fixed behind the whole screen. `welcome` uses the taller ridges of the Welcome screen. */
export function NightRidges({ variant = 'default' }: { variant?: 'default' | 'welcome' }) {
  const welcome = variant === 'welcome';
  return (
    <div className={styles.backdrop} aria-hidden="true">
      <div className={styles.gradient} />
      <Drawing className={styles.phone} width={390} height={844} stars={welcome ? WELCOME_STARS : PHONE_STARS} ridges={welcome ? WELCOME_RIDGES : PHONE_RIDGES} />
      <Drawing className={styles.wide} width={1280} height={800} stars={WIDE_STARS} ridges={WIDE_RIDGES} />
    </div>
  );
}
