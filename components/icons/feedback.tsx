import * as React from "react";

const baseProps = {
  xmlns: "http://www.w3.org/2000/svg",
  fill: "none",
  viewBox: "0 0 24 24",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

type IconProps = React.SVGProps<SVGSVGElement>;

export const RecoveryIcon = React.forwardRef<SVGSVGElement, IconProps>((props, ref) => (
  <svg ref={ref} {...baseProps} {...props}>
    <path d="M5 16c0-4.418 3.134-8 7-8h5" />
    <path d="m15 5 3 3-3 3" />
    <path d="M5 19c3 0 5-2 5-5" />
  </svg>
));
RecoveryIcon.displayName = "RecoveryIcon";

export const MomentumIcon = React.forwardRef<SVGSVGElement, IconProps>((props, ref) => (
  <svg ref={ref} {...baseProps} {...props}>
    <path d="M4 16 9.5 10.5 13 14l7-9" />
    <path d="M14 5h6v6" />
  </svg>
));
MomentumIcon.displayName = "MomentumIcon";

export const ConsistencyIcon = React.forwardRef<SVGSVGElement, IconProps>((props, ref) => (
  <svg ref={ref} {...baseProps} {...props}>
    <path d="M4 16h16" />
    <path d="M6 11h12" />
    <path d="M8 6h8" />
    <circle cx="12" cy="11" r="2.5" />
  </svg>
));
ConsistencyIcon.displayName = "ConsistencyIcon";
