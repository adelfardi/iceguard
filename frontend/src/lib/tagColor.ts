import type { CSSProperties } from 'react';

/** Deterministic, evenly-spread hue from a tag string → stable color across the app. */
export function tagColorStyle(tag: string): CSSProperties {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) % 360;
  return {
    backgroundColor: `hsl(${h} 65% 50% / 0.16)`,
    color: `hsl(${h} 70% 72%)`,
    borderColor: `hsl(${h} 65% 50% / 0.35)`,
  };
}
