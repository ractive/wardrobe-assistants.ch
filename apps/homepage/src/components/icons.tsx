// Inline SVG icons. We do NOT depend on `lucide-react` here, because pulling
// the library into the homepage bundle ships its runtime + breaks Lighthouse's
// "Legacy JavaScript" insight on /services (Lucide's transpile target adds
// polyfills for Array.prototype.at/.flat/.flatMap, Object.fromEntries, etc.).
//
// To add a new icon:
//   1. Find it on https://lucide.dev/icons (Lucide is the visual reference).
//   2. Open `node_modules/lucide-react/dist/esm/icons/<kebab-name>.mjs` and
//      copy the `__iconNode` array — each entry is `[tagName, attrs]`.
//   3. Add a new `export const <Name>: Icon = (props) => (<Svg {...props}>…</Svg>)`
//      below, translating each iconNode entry to JSX (drop the `key` field;
//      it's only meaningful when Lucide renders the array dynamically).
//   4. Import it from `@/components/icons` at the call site.
//
// All icons inherit the standard Lucide attrs (24×24, stroke=currentColor,
// stroke-width=2, round caps/joins) from the `Svg` wrapper, so the visual
// output matches `lucide-react` exactly.

import type { ReactElement, SVGProps } from "react";

export type IconProps = SVGProps<SVGSVGElement>;
export type Icon = (props: IconProps) => ReactElement;

function Svg({ children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const ClipboardList: Icon = (props) => (
  <Svg {...props}>
    <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <path d="M12 11h4" />
    <path d="M12 16h4" />
    <path d="M8 11h.01" />
    <path d="M8 16h.01" />
  </Svg>
);

export const Crown: Icon = (props) => (
  <Svg {...props}>
    <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
    <path d="M5 21h14" />
  </Svg>
);

export const Droplets: Icon = (props) => (
  <Svg {...props}>
    <path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z" />
    <path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97" />
  </Svg>
);

export const Scissors: Icon = (props) => (
  <Svg {...props}>
    <circle cx="6" cy="6" r="3" />
    <path d="M8.12 8.12 12 12" />
    <path d="M20 4 8.12 15.88" />
    <circle cx="6" cy="18" r="3" />
    <path d="M14.8 14.8 20 20" />
  </Svg>
);

export const Shirt: Icon = (props) => (
  <Svg {...props}>
    <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" />
  </Svg>
);

export const Truck: Icon = (props) => (
  <Svg {...props}>
    <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
    <path d="M15 18H9" />
    <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
    <circle cx="17" cy="18" r="2" />
    <circle cx="7" cy="18" r="2" />
  </Svg>
);

export const Menu: Icon = (props) => (
  <Svg {...props}>
    <path d="M4 5h16" />
    <path d="M4 12h16" />
    <path d="M4 19h16" />
  </Svg>
);

export const X: Icon = (props) => (
  <Svg {...props}>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </Svg>
);
