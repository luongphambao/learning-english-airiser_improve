import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { useT } from '@/hooks/use-i18n';

interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function Sheet({ isOpen, onClose, title, children }: SheetProps) {
  const { t } = useT();
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-xs transition-opacity animate-fade-in">
      {/* Backdrop click */}
      <div className="absolute inset-0" onClick={() => onClose()} />

      {/* Bottom Sheet Box */}
      <div className="relative w-full max-w-[480px] bg-surface border-t border-rule rounded-t-[24px] shadow-2xl p-6 max-h-[88vh] overflow-y-auto animate-slide-up z-10">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-rule">
          {title ? (
            <h2 className="font-serif-display text-2xl text-ink">{title}</h2>
          ) : (
            <div className="w-12 h-1 bg-rule rounded-full mx-auto" />
          )}
          <button
            onClick={() => onClose()}
            className="p-1 rounded-full text-ink-soft hover:bg-paper transition-colors cursor-pointer"
            aria-label={t('components.sheet.close')}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
