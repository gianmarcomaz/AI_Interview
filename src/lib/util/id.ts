export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
export const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
