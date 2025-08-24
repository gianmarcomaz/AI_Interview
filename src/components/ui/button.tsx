import React from 'react';
import { CTA_STYLES, CtaStyle } from './tokens';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'xl';
  cta?: CtaStyle; // semantic gradient palette
  shadow?: boolean; // apply glow shadow
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'default', size = 'default', cta, shadow = false, ...props }, ref) => {
    const baseClasses = 'inline-flex items-center justify-center text-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background';
    
    const variantClasses = {
      default: 'bg-primary text-primary-foreground hover:bg-primary/90',
      destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
      secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
    };
    
    const sizeClasses = {
      default: 'h-10 py-2 px-4 rounded-md',
      sm: 'h-9 px-3 rounded-md',
      lg: 'h-11 px-6 rounded-lg',
      xl: 'h-12 px-6 rounded-xl',
    } as const;
    
    const ctaClasses = cta ? CTA_STYLES[cta] : '';
    const shadowClass = shadow ? 'shadow-glow' : '';
    const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${ctaClasses} ${shadowClass} ${className}`.trim();
    
    return (
      <button
        className={classes}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
