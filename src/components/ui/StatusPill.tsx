'use client';

import clsx from 'clsx';

export default function StatusPill({
  on,
  labelOn = 'Recording',
  labelOff = 'Stopped',
  size = 'sm',
  className = '',
}: {
  on: boolean;
  labelOn?: string;
  labelOff?: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const h = size === 'sm' ? 'h-8 px-3 text-xs' : 'h-10 px-4 text-sm';
  const dot = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3';

  return (
    <div
      role="status"
      aria-live="polite"
      className={clsx(
        'inline-flex items-center gap-2 rounded-full border whitespace-nowrap select-none',
        'backdrop-blur-sm transition-colors',
        on
          ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-100'
          : 'bg-slate-500/15 border-slate-300/40 text-slate-200',
        h,
        className
      )}
    >
      <span
        className={clsx(
          'inline-block rounded-full shrink-0',
          on
            ? 'bg-emerald-400 shadow-[0_0_0_3px_rgba(16,185,129,0.18)]'
            : 'bg-slate-400',
          dot
        )}
      />
      <span className="font-semibold leading-none">
        {on ? labelOn : labelOff}
      </span>
    </div>
  );
}
