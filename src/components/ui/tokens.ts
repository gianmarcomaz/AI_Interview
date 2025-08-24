export type CtaStyle =
  | 'primary'   // blue -> purple
  | 'success'   // emerald/green
  | 'danger'    // red/rose
  | 'info'      // indigo/violet
  | 'slate'     // gray/surface
  | 'cyan'      // cyan/sky
  | 'amber'     // amber/orange
  | 'purple';   // purple/fuchsia

export const CTA_STYLES: Record<CtaStyle, string> = {
  primary: 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700',
  success: 'bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-700 hover:to-green-800',
  danger:  'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700',
  info:    'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700',
  slate:   'bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800',
  cyan:    'bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700',
  amber:   'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700',
  purple:  'bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700',
};



