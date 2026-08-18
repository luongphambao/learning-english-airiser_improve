'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BackHeader } from '@/components/layout/back-header';
import { useT } from '@/hooks/use-i18n';
import { Mail, ArrowRight, CheckCircle2, AlertCircle, Loader2, LogOut, User, Lock, UserPlus, Compass } from 'lucide-react';
import { enterGuestMode } from '@/lib/auth/guest';
import {
  GOOGLE_SIGNIN_ENABLED,
  completeGoogleRedirect,
  describeAuthError,
  registerWithEmail,
  sendPasswordReset,
  signInWithEmail,
  signInWithGoogle,
  signOutEverywhere,
} from '@/lib/auth/firebase-auth';

type Mode = 'login' | 'register';

export default function LoginPage() {
  const router = useRouter();
  const { t } = useT();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [userSession, setUserSession] = useState<{ email: string; name?: string; loginMethod?: string } | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const checkAuthStatus = async () => {
    try {
      setStatusLoading(true);
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUserSession(data.authenticated && data.user ? data.user : null);
      }
    } catch {
      // Ignore
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      // Picks up the result of signInWithGoogle()'s redirect, if this load is
      // the browser coming back from accounts.google.com. Resolves to null on
      // any ordinary page load, so this is safe to always run first. Skipped
      // entirely while GOOGLE_SIGNIN_ENABLED is false — no redirect can be
      // in flight if the button that starts one is hidden.
      if (GOOGLE_SIGNIN_ENABLED) {
        try {
          const user = await completeGoogleRedirect();
          if (user) {
            setNotice({ type: 'success', message: t('login.googleSuccess') });
            window.dispatchEvent(new Event('lexio-auth-changed'));
            setTimeout(() => router.push('/onboarding'), 600);
            return;
          }
        } catch (err) {
          setNotice({ type: 'error', message: describeAuthError(err) });
        }
      }
      await checkAuthStatus();
    })();

    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const errorParam = urlParams.get('gmail_error') || urlParams.get('error');
      if (errorParam === 'config_missing') {
        setNotice({
          type: 'error',
          message: t('login.googleConfigMissing'),
        });
      } else if (errorParam) {
        setNotice({
          type: 'error',
          message: t('login.googleFailed'),
        });
      }
    }
  }, []);

  // /onboarding, not /today (docs/decision.md ADR-028) — it asks the goal question
  // once and forwards straight on for anyone who has already answered or skipped it,
  // so a returning learner sees a spinner's worth of delay, not a form.
  const afterSignedIn = () => {
    setNotice({ type: 'success', message: mode === 'register' ? t('login.accountCreated') : t('login.signInSuccess') });
    window.dispatchEvent(new Event('lexio-auth-changed'));
    setTimeout(() => router.push('/onboarding'), 600);
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setNotice({ type: 'error', message: t('login.invalidEmail') });
      return;
    }
    if (password.length < 6) {
      setNotice({ type: 'error', message: t('login.passwordTooShort') });
      return;
    }

    setLoading(true);
    setNotice(null);
    try {
      if (mode === 'register') {
        await registerWithEmail(email.trim(), password, name.trim() || undefined);
      } else {
        await signInWithEmail(email.trim(), password);
      }
      afterSignedIn();
    } catch (err) {
      setNotice({ type: 'error', message: describeAuthError(err) });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setNotice(null);
    try {
      // Navigates the whole page to accounts.google.com on success — this
      // call only returns (by throwing) if the redirect itself couldn't
      // start. The actual sign-in is picked up above, in the mount effect,
      // once the browser comes back.
      await signInWithGoogle();
    } catch (err) {
      setGoogleLoading(false);
      setNotice({ type: 'error', message: describeAuthError(err) });
    }
  };

  // /onboarding rather than /today: a guest with an empty notebook would be greeted
  // by nothing there. Onboarding forwards to the placement test (entirely local —
  // corpus + Dexie, no auth, no network) once the goal question is done, so a guest
  // still reaches real content in two taps (docs/decision.md ADR-028).
  const handleTryAsGuest = () => {
    enterGuestMode();
    window.dispatchEvent(new Event('lexio-auth-changed'));
    router.push('/onboarding');
  };

  const handleForgotPassword = async () => {
    if (!email.trim() || !email.includes('@')) {
      setNotice({ type: 'error', message: t('login.forgotPasswordNeedsEmail') });
      return;
    }
    try {
      await sendPasswordReset(email.trim());
      setNotice({ type: 'success', message: t('login.passwordResetSent') });
    } catch (err) {
      setNotice({ type: 'error', message: describeAuthError(err) });
    }
  };

  const handleLogout = async () => {
    try {
      await signOutEverywhere();
      setUserSession(null);
      window.dispatchEvent(new Event('lexio-auth-changed'));
      setNotice({ type: 'success', message: t('login.signedOut') });
    } catch {
      setNotice({ type: 'error', message: t('login.signOutFailed') });
    }
  };

  return (
    <>
      <BackHeader title={t('login.title')} />
      <div className="pt-6 pb-12 max-w-sm mx-auto space-y-6">

        {/* Brand Header */}
        <div className="text-center space-y-1.5">
          <div className="font-serif text-5xl font-bold text-ink tracking-tight">Lexio</div>
          <div className="font-mono-utility text-xs text-ink-soft">/ˈleksioʊ/</div>
          <p className="text-sm text-ink-soft max-w-[28ch] mx-auto pt-2 leading-relaxed">
            {t('login.tagline')}
          </p>
        </div>

        {statusLoading ? (
          <div className="p-8 rounded-2xl bg-surface border border-rule flex flex-col items-center justify-center gap-2 text-ink-soft">
            <Loader2 className="w-5 h-5 animate-spin text-green" />
            <span className="text-xs">{t('login.checkingStatus')}</span>
          </div>
        ) : userSession ? (
          /* Logged In State */
          <div className="p-6 rounded-2xl bg-surface border border-rule space-y-4 shadow-xs text-center">
            <div className="w-12 h-12 rounded-full bg-green-wash border border-green/20 text-green flex items-center justify-center mx-auto">
              <User className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs text-ink-soft">{t('login.loggedInAs')}</div>
              <div className="text-base font-semibold text-ink font-mono-utility mt-0.5">{userSession.email}</div>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={() => router.push('/today')}
                className="w-full py-3 px-4 rounded-xl bg-green text-paper text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer hover:bg-green/90 transition"
              >
                {t('login.goToApp')}
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={handleLogout}
                className="w-full py-2.5 px-4 rounded-xl border border-rule text-ink-soft hover:text-wrong hover:border-wrong/30 text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer transition"
              >
                <LogOut className="w-3.5 h-3.5" />
                {t('login.signOut')}
              </button>
            </div>
          </div>
        ) : (
          /* Email Login / Register Form */
          <div className="p-6 rounded-2xl bg-surface border border-rule shadow-xs space-y-5">
            <div className="flex rounded-xl bg-paper border border-rule p-1 text-xs font-mono-utility">
              <button
                type="button"
                onClick={() => setMode('login')}
                className={`flex-1 py-2 rounded-lg transition cursor-pointer ${
                  mode === 'login' ? 'bg-green text-paper' : 'text-ink-soft hover:text-ink'
                }`}
              >
                {t('login.tabSignIn')}
              </button>
              <button
                type="button"
                onClick={() => setMode('register')}
                className={`flex-1 py-2 rounded-lg transition cursor-pointer ${
                  mode === 'register' ? 'bg-green text-paper' : 'text-ink-soft hover:text-ink'
                }`}
              >
                {t('login.tabRegister')}
              </button>
            </div>

            <form onSubmit={handleEmailSubmit} className="space-y-4">
              {mode === 'register' && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-mono-utility text-ink-soft">{t('login.nameLabel')}</label>
                  <div className="relative">
                    <UserPlus className="w-4 h-4 text-ink-soft absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder={t('login.namePlaceholder')}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-3 rounded-xl bg-paper border border-rule text-sm text-ink placeholder:text-ink-soft/50 focus:outline-none focus:border-green transition"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-mono-utility text-ink-soft">{t('login.emailLabel')}</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-ink-soft absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    required
                    placeholder={t('login.emailPlaceholder')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-3 rounded-xl bg-paper border border-rule text-sm text-ink placeholder:text-ink-soft/50 focus:outline-none focus:border-green transition"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-mono-utility text-ink-soft">{t('login.passwordLabel')}</label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="text-xs text-green hover:underline cursor-pointer"
                    >
                      {t('login.forgotPassword')}
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-ink-soft absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-3 rounded-xl bg-paper border border-rule text-sm text-ink placeholder:text-ink-soft/50 focus:outline-none focus:border-green transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 rounded-xl bg-green text-paper text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer hover:bg-green/90 transition active:scale-98 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {mode === 'register' ? t('login.creatingAccount') : t('login.signingIn')}
                  </>
                ) : (
                  <>
                    {mode === 'register' ? t('login.submitRegister') : t('login.submitSignIn')}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {GOOGLE_SIGNIN_ENABLED && (
              <>
                <div className="relative flex items-center py-1">
                  <div className="flex-grow border-t border-rule"></div>
                  <span className="flex-shrink mx-3 text-xs text-ink-soft font-mono-utility">{t('login.orDivider')}</span>
                  <div className="flex-grow border-t border-rule"></div>
                </div>

                <button
                  onClick={handleGoogleLogin}
                  type="button"
                  disabled={googleLoading}
                  className="w-full py-3 px-4 rounded-xl border border-rule bg-paper hover:bg-surface text-ink text-sm font-medium flex items-center justify-center gap-2.5 cursor-pointer transition active:scale-98 disabled:opacity-50"
                >
                  {googleLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                  )}
                  {t('login.googleSignIn')}
                </button>
              </>
            )}

            <div className="pt-1 space-y-2 border-t border-rule">
              <button
                onClick={handleTryAsGuest}
                type="button"
                className="mt-4 w-full py-3 px-4 rounded-xl border border-rule bg-paper hover:bg-surface text-ink text-sm font-medium flex items-center justify-center gap-2 cursor-pointer transition active:scale-98"
              >
                <Compass className="w-4 h-4" />
                {t('login.guestCta')}
              </button>
              <p className="text-xs text-ink-soft leading-relaxed text-center">
                {t('login.guestLimits')}
              </p>
            </div>
          </div>
        )}

        {notice && (
          <div
            className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
              notice.type === 'success'
                ? 'bg-green-wash text-green border border-green/20'
                : 'bg-wrong/10 text-wrong border border-wrong/20'
            }`}
          >
            {notice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <span>{notice.message}</span>
          </div>
        )}
      </div>
    </>
  );
}
