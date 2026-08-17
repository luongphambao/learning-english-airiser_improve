'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useProfile } from '@/hooks/use-profile';
import { useSettingsStore } from '@/stores/settings-store';
import { useLevelStore } from '@/stores/level-store';
import { useSyncStore } from '@/stores/sync-store';
import { BackHeader } from '@/components/layout/back-header';
import { getRepos } from '@/lib/repositories';
import { NAME_MAX_LENGTH } from '@/lib/leaderboard/name';
import { useT } from '@/hooks/use-i18n';
import type { UserSettings } from '@/types';
import { Mail, CheckCircle2, AlertCircle, Send, Loader2, LogOut, Calendar, ChevronRight, RefreshCw, CloudOff } from 'lucide-react';

export default function SettingsPage() {
  const { settings } = useProfile();
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const setDeclaredLevel = useLevelStore((s) => s.setDeclared);
  const { t } = useT();
  const syncStatus = useSyncStore((s) => s.status);
  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt);
  const syncError = useSyncStore((s) => s.error);
  const runSync = useSyncStore((s) => s.sync);
  const hydrateSync = useSyncStore((s) => s.hydrate);

  const [gmailStatus, setGmailStatus] = useState<{ connected: boolean; email?: string } | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailNotice, setEmailNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  // Real Firebase sign-in status — deliberately NOT gmailStatus (that's the
  // separate Gmail-reminder connection, see app/api/auth/google/callback's
  // comment). The sync card only makes sense once actually signed in.
  const [signedIn, setSignedIn] = useState(false);

  const fetchGmailStatus = async () => {
    try {
      setLoadingStatus(true);
      const res = await fetch('/api/auth/google/status');
      if (res.ok) {
        const data = await res.json();
        setGmailStatus(data);
      }
    } catch (e) {
      console.error('Failed to fetch Gmail status:', e);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    fetchGmailStatus();
    void hydrateSync();
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => setSignedIn(!!data.authenticated))
      .catch(() => setSignedIn(false));

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('gmail') === 'connected') {
      setEmailNotice({ type: 'success', message: t('settings.notices.connectedSuccess') });
    } else if (urlParams.get('gmail_error') === 'config_missing') {
      setEmailNotice({ type: 'error', message: t('settings.notices.oauthConfigMissing') });
    } else if (urlParams.get('gmail_error')) {
      setEmailNotice({ type: 'error', message: t('settings.notices.connectFailed') });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConnectGmail = () => {
    window.location.href = '/api/auth/google/login';
  };

  const handleDisconnectGmail = async () => {
    try {
      await fetch('/api/auth/google/logout', { method: 'POST' });
      setGmailStatus({ connected: false });
      setEmailNotice({ type: 'success', message: t('settings.notices.disconnectedSuccess') });
    } catch {
      setEmailNotice({ type: 'error', message: t('settings.notices.disconnectError') });
    }
  };

  const handleSendTestEmail = async () => {
    try {
      setSendingEmail(true);
      setEmailNotice(null);
      // The route rejects an empty word list rather than inventing sample words,
      // so say why here instead of letting it surface as a generic 422.
      const dueWords = await getRepos().words.dueBefore(Date.now(), 5);
      if (dueWords.length === 0) {
        setEmailNotice({ type: 'error', message: t('settings.notices.sendNoDueWords') });
        return;
      }
      const res = await fetch('/api/gmail/send-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          words: dueWords.map((w) => ({
            word: w.word,
            meaningVi: w.meaningVi,
            exampleSentence: w.exampleSentence,
            ipa: w.ipa,
          })),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setEmailNotice({
          type: 'success',
          message: t('settings.notices.sendSuccess', { recipient: data.recipient }),
        });
      } else {
        setEmailNotice({
          type: 'error',
          message: data?.error?.message || t('settings.notices.sendFailedFallback'),
        });
      }
    } catch {
      setEmailNotice({ type: 'error', message: t('settings.notices.sendSystemError') });
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <>
      <BackHeader title={t('settings.title')} />
      <div className="space-y-6 pt-6 max-w-md pb-12">
        {/* Account Login Section */}
        <div className="p-4 rounded-2xl bg-surface border border-rule space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-green-wash text-green flex items-center justify-center font-bold text-xs">
                {gmailStatus?.email ? gmailStatus.email[0].toUpperCase() : 'L'}
              </div>
              <div>
                <h2 className="text-sm font-semibold text-ink">{t('settings.account.title')}</h2>
                <p className="text-xs text-ink-soft">
                  {gmailStatus?.email ? gmailStatus.email : t('settings.account.notLoggedIn')}
                </p>
              </div>
            </div>
            <a
              href="/login"
              className="px-3 py-1.5 rounded-xl border border-rule text-xs font-medium text-ink hover:border-green hover:text-green transition cursor-pointer"
            >
              {gmailStatus?.email ? t('settings.account.manage') : t('settings.account.login')}
            </a>
          </div>
        </div>

        {/* Sync status — lib/sync/**. Only meaningful once actually signed in
            via Firebase (not just Gmail-connected, see the signedIn comment
            above); the app works fully offline/signed-out otherwise. */}
        {signedIn && (
          <div className="p-4 rounded-2xl bg-surface border border-rule space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                {syncStatus === 'syncing' ? (
                  <RefreshCw className="w-4 h-4 text-green animate-spin shrink-0" />
                ) : syncStatus === 'error' || syncStatus === 'offline' ? (
                  <CloudOff className="w-4 h-4 text-ink-soft shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-green shrink-0" />
                )}
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-ink">{t('settings.sync.title')}</h2>
                  <p className="text-xs text-ink-soft truncate">
                    {syncStatus === 'syncing'
                      ? t('settings.sync.syncing')
                      : syncStatus === 'offline'
                        ? t('settings.sync.offline')
                        : syncStatus === 'error'
                          ? (syncError ?? t('settings.sync.errorFallback'))
                          : lastSyncedAt
                            ? t('settings.sync.syncedAt', { time: new Date(lastSyncedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) })
                            : t('settings.sync.never')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => void runSync(Date.now())}
                disabled={syncStatus === 'syncing'}
                className="px-3 py-1.5 rounded-xl border border-rule text-xs font-medium text-ink hover:border-green hover:text-green transition cursor-pointer disabled:opacity-50 shrink-0"
              >
                {t('settings.sync.syncNow')}
              </button>
            </div>
          </div>
        )}

        {/* Leaderboard display name — only meaningful once signed in, since a
            signed-out learner has no published row (docs/decision.md ADR-025).
            NAME_MAX_LENGTH mirrors firestore.rules' name.size() <= 40; kept out of
            the Zod domain schema on purpose (lib/domain/user.ts's leaderboardName
            comment) so an over-long value never resets every other setting. */}
        {signedIn && (
          <div className="p-4 rounded-2xl bg-surface border border-rule space-y-2">
            <h2 className="text-sm font-semibold text-ink">{t('settings.leaderboard.title')}</h2>
            <input
              type="text"
              value={settings.leaderboardName ?? ''}
              onChange={(e) => updateSettings({ leaderboardName: e.target.value.trim() || null })}
              maxLength={NAME_MAX_LENGTH}
              placeholder={t('settings.leaderboard.namePlaceholder')}
              className="w-full p-3 rounded-xl bg-paper border border-rule text-sm text-ink focus:outline-none focus:border-green"
            />
            <p className="text-xs text-ink-soft leading-relaxed">{t('settings.leaderboard.publicNotice')}</p>
          </div>
        )}

        {/* Gmail Reminder Section */}
        <div className="p-4 rounded-2xl bg-surface border border-rule space-y-3">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-green" />
            <h2 className="text-sm font-semibold text-ink">{t('settings.gmail.title')}</h2>
          </div>
          <p className="text-xs text-ink-soft leading-relaxed">{t('settings.gmail.description')}</p>

          {loadingStatus ? (
            <div className="flex items-center gap-2 text-xs text-ink-soft py-2">
              <Loader2 className="w-4 h-4 animate-spin text-green" />
              {t('settings.gmail.checkingConnection')}
            </div>
          ) : gmailStatus?.connected ? (
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-green-wash border border-green/20">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="w-4 h-4 text-green shrink-0" />
                  <span className="text-xs font-mono-utility text-ink truncate">
                    {gmailStatus.email}
                  </span>
                </div>
                <button
                  onClick={handleDisconnectGmail}
                  className="text-xs text-wrong hover:underline flex items-center gap-1 shrink-0 ml-2"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  {t('settings.gmail.disconnect')}
                </button>
              </div>

              <button
                onClick={handleSendTestEmail}
                disabled={sendingEmail}
                className="w-full py-2.5 px-3 rounded-xl bg-green text-paper text-xs font-medium flex items-center justify-center gap-2 cursor-pointer hover:bg-green/90 transition disabled:opacity-50"
              >
                {sendingEmail ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {t('settings.gmail.sendingEmail')}
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    {t('settings.gmail.sendTestEmail')}
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="pt-1">
              <button
                onClick={handleConnectGmail}
                className="w-full py-2.5 px-3 rounded-xl bg-green text-paper text-xs font-medium flex items-center justify-center gap-2 cursor-pointer hover:bg-green/90 transition"
              >
                <Mail className="w-4 h-4" />
                {t('settings.gmail.connect')}
              </button>
            </div>
          )}

          {emailNotice && (
            <div
              className={`p-2.5 rounded-xl text-xs flex items-start gap-2 ${
                emailNotice.type === 'success'
                  ? 'bg-green-wash text-green border border-green/20'
                  : 'bg-wrong/10 text-wrong border border-wrong/20'
              }`}
            >
              {emailNotice.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span>{emailNotice.message}</span>
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-mono-utility text-ink-soft mb-2">
            {t('settings.contextTopic.label')}
          </label>
          <input
            type="text"
            value={settings.contextTopic}
            onChange={(e) => updateSettings({ contextTopic: e.target.value })}
            placeholder="e.g. software engineering, marketing, finance"
            className="w-full p-3 rounded-xl bg-paper border border-rule text-sm text-ink focus:outline-none focus:border-green"
          />
        </div>

        <div>
          <label htmlFor="settings-level" className="block text-xs font-mono-utility text-ink-soft mb-2">
            {t('settings.level.label')}
          </label>
          <select
            id="settings-level"
            value={settings.level}
            onChange={(e) => setDeclaredLevel(e.target.value as UserSettings['level'], Date.now())}
            className="w-full p-3 rounded-xl bg-paper border border-rule text-sm text-ink"
          >
            <option value="A2">A2 — Elementary</option>
            <option value="B1">B1 — Intermediate</option>
            <option value="B2">B2 — Upper-Intermediate</option>
            <option value="C1">C1 — Advanced</option>
            <option value="C2">C2 — Proficient</option>
          </select>
          {/* docs/decision.md ADR-017 — a level change is never silent (unlike the
              streak freeze): this line shows WHY the app thinks the user is at this
              level, so a self-declared choice and an auto-detected one both stay
              legible. */}
          <p className="mt-2 text-xs text-ink-soft">
            {settings.levelProfile.declared
              ? t('settings.level.declared')
              : settings.levelProfile.placement
                ? t('settings.level.placement')
                : settings.levelProfile.work || settings.levelProfile.srs
                  ? t('settings.level.autoAdjusted')
                  : t('settings.level.defaultFallback')}
          </p>
        </div>

        <div>
          <label className="block text-xs font-mono-utility text-ink-soft mb-2">{t('settings.sessionSize.label')}</label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => updateSettings({ sessionSize: Math.max(3, settings.sessionSize - 1) })}
              disabled={settings.sessionSize <= 3}
              className="w-10 h-10 rounded-xl border border-rule text-ink text-lg font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:border-green transition-colors"
              aria-label={t('settings.sessionSize.decreaseAria')}
            >
              −
            </button>
            <span className="font-mono-utility text-sm text-ink w-8 text-center">{settings.sessionSize}</span>
            <button
              type="button"
              onClick={() => updateSettings({ sessionSize: Math.min(20, settings.sessionSize + 1) })}
              disabled={settings.sessionSize >= 20}
              className="w-10 h-10 rounded-xl border border-rule text-ink text-lg font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:border-green transition-colors"
              aria-label={t('settings.sessionSize.increaseAria')}
            >
              +
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-mono-utility text-ink-soft mb-2">{t('settings.theme.label')}</label>
          <div className="flex gap-2">
            <button
              onClick={() => updateSettings({ theme: 'light' })}
              className={`flex-1 py-2.5 rounded-xl border text-xs font-medium cursor-pointer ${
                settings.theme === 'light'
                  ? 'border-green bg-green-wash text-green'
                  : 'border-rule bg-paper text-ink-soft'
              }`}
            >
              {t('settings.theme.light')}
            </button>
            <button
              onClick={() => updateSettings({ theme: 'dark' })}
              className={`flex-1 py-2.5 rounded-xl border text-xs font-medium cursor-pointer ${
                settings.theme === 'dark'
                  ? 'border-green bg-green-wash text-green'
                  : 'border-rule bg-paper text-ink-soft'
              }`}
            >
              {t('settings.theme.dark')}
            </button>
          </div>
        </div>

        <Link
          href="/calendar"
          className="flex items-center justify-between p-4 rounded-2xl bg-surface border border-rule hover:border-green transition-colors"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Calendar size={18} className="text-green" />
            {t('settings.studyPlan.title')}
          </span>
          <ChevronRight size={18} className="text-ink-soft" />
        </Link>
      </div>
    </>
  );
}

