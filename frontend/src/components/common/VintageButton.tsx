import type { ButtonHTMLAttributes, ReactNode } from "react";

import {
  vintageButtonStyles,
  type VintageButtonSize,
  type VintageButtonVariant,
} from "./vintage-button.styles";

export type VintageButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: VintageButtonVariant;
  size?: VintageButtonSize;
  icon?: ReactNode;
};

export function VintageButton({
  variant = "primary",
  size = "md",
  icon,
  className,
  children,
  type = "button",
  ...props
}: VintageButtonProps) {
  return (
    <button type={type} className={vintageButtonStyles({ variant, size, className })} {...props}>
      {icon}
      {children}
    </button>
  );
}
