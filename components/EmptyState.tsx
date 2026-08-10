import React from 'react';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6 bg-surface border border-rule rounded-[16px]">
      {icon && <div className="text-ink-soft mb-3 p-3 rounded-full bg-paper">{icon}</div>}
      <h3 className="font-serif-display text-2xl text-ink mb-2">{title}</h3>
      {description && <p className="text-ink-soft text-sm mb-6 max-w-xs">{description}</p>}
      {actionLabel && onAction && (
        <Button variant="primary" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
