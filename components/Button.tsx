import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'quiet' | 'danger';
  children: React.ReactNode;
}

export function Button({ variant = 'primary', children, className = '', ...props }: ButtonProps) {
  let baseStyles =
    'px-5 py-2.5 rounded-xl text-[14px] font-semibold transition-all duration-200 active:scale-[0.97] cursor-pointer inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 shadow-xs';

  if (variant === 'primary') {
    baseStyles += ' bg-green text-paper hover:brightness-110 hover:shadow-md';
  } else if (variant === 'quiet') {
    baseStyles += ' bg-surface text-ink-soft hover:bg-green-wash hover:text-ink border border-rule';
  } else if (variant === 'danger') {
    baseStyles += ' bg-wrong text-paper hover:brightness-110 hover:shadow-md';
  }

  return (
    <button className={`${baseStyles} ${className}`} {...props}>
      {children}
    </button>
  );
}
