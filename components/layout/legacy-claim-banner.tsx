'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Sheet } from '@/components/Sheet';
import { claimLegacyNotebook, declineLegacyClaim, hasPendingLegacyClaim } from '@/lib/db/claim-legacy';
import { useT } from '@/hooks/use-i18n';

/**
 * Shown once per account, right after the first sign-in that lands on an
 * empty per-account notebook while this browser still has a pre-account
 * local notebook sitting around (see lib/db/claim-legacy.ts for why this
 * asks instead of copying automatically). Mounted from app/providers.tsx's
 * AuthProvider, after setActiveUser()/resetRepos() have already switched to
 * the signed-in account's database.
 */
export function LegacyClaimBanner() {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    hasPendingLegacyClaim().then((pending) => {
      if (!cancelled && pending) setOpen(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleClaim = async () => {
    setBusy(true);
    try {
      await claimLegacyNotebook();
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  const handleDecline = async () => {
    setBusy(true);
    try {
      await declineLegacyClaim();
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  return (
    <Sheet isOpen={open} onClose={handleDecline} title={t('components.legacyClaimBanner.title')}>
      <div className="space-y-4">
        <p className="text-sm text-ink-soft leading-relaxed">{t('components.legacyClaimBanner.body')}</p>
        <div className="flex flex-col gap-2">
          <button
            onClick={handleClaim}
            disabled={busy}
            className="w-full py-3 px-4 rounded-xl bg-green text-paper text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer hover:bg-green/90 transition disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : t('components.legacyClaimBanner.claimCta')}
          </button>
          <button
            onClick={handleDecline}
            disabled={busy}
            className="w-full py-2.5 px-4 rounded-xl border border-rule text-ink-soft hover:text-ink text-xs font-medium cursor-pointer transition disabled:opacity-50"
          >
            {t('components.legacyClaimBanner.declineCta')}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
