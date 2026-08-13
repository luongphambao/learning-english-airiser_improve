'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useProfile } from '@/hooks/use-profile';
import { useSettingsStore } from '@/stores/settings-store';
import { BackHeader } from '@/components/layout/back-header';
import { getRepos } from '@/lib/repositories';
import type { UserSettings } from '@/types';
import { Mail, CheckCircle2, AlertCircle, Send, Loader2, LogOut, Calendar, ChevronRight } from 'lucide-react';

export default function SettingsPage() {
  const { settings } = useProfile();
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  const [gmailStatus, setGmailStatus] = useState<{ connected: boolean; email?: string } | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailNotice, setEmailNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('gmail') === 'connected') {
      setEmailNotice({ type: 'success', message: 'Đã kết nối tài khoản Gmail thành công!' });
    } else if (urlParams.get('gmail_error') === 'config_missing') {
      setEmailNotice({ type: 'error', message: 'Google OAuth chưa được cấu hình Client ID trên hệ thống.' });
    } else if (urlParams.get('gmail_error')) {
      setEmailNotice({ type: 'error', message: 'Kết nối Gmail thất bại. Vui lòng thử lại.' });
    }
  }, []);

  const handleConnectGmail = () => {
    window.location.href = '/api/auth/google/login';
  };

  const handleDisconnectGmail = async () => {
    try {
      await fetch('/api/auth/google/logout', { method: 'POST' });
      setGmailStatus({ connected: false });
      setEmailNotice({ type: 'success', message: 'Đã ngắt kết nối Gmail.' });
    } catch {
      setEmailNotice({ type: 'error', message: 'Lỗi khi ngắt kết nối.' });
    }
  };

  const handleSendTestEmail = async () => {
    try {
      setSendingEmail(true);
      setEmailNotice(null);
      // Send the user's actual due words — without this the route falls back to a
      // hardcoded sample ("constitute", ...) regardless of what's in the notebook,
      // which would make the email lie about what needs reviewing.
      const dueWords = await getRepos().words.dueBefore(Date.now(), 5);
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
          message: `Đã gửi thành công email 5 từ vựng tới ${data.recipient}!`,
        });
      } else {
        setEmailNotice({
          type: 'error',
          message: data.message || 'Không thể gửi email. Vui lòng kiểm tra lại kết nối.',
        });
      }
    } catch {
      setEmailNotice({ type: 'error', message: 'Lỗi hệ thống khi gửi email.' });
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <>
      <BackHeader title="Cài đặt" />
      <div className="space-y-6 pt-6 max-w-md pb-12">
        {/* Account Login Section */}
        <div className="p-4 rounded-2xl bg-surface border border-rule space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-green-wash text-green flex items-center justify-center font-bold text-xs">
                {gmailStatus?.email ? gmailStatus.email[0].toUpperCase() : 'L'}
              </div>
              <div>
                <h2 className="text-sm font-semibold text-ink">Tài khoản Lexio</h2>
                <p className="text-xs text-ink-soft">
                  {gmailStatus?.email ? gmailStatus.email : 'Chưa đăng nhập email'}
                </p>
              </div>
            </div>
            <a
              href="/login"
              className="px-3 py-1.5 rounded-xl border border-rule text-xs font-medium text-ink hover:border-green hover:text-green transition cursor-pointer"
            >
              {gmailStatus?.email ? 'Quản lý' : 'Đăng nhập'}
            </a>
          </div>
        </div>

        {/* Gmail Reminder Section */}
        <div className="p-4 rounded-2xl bg-surface border border-rule space-y-3">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-green" />
            <h2 className="text-sm font-semibold text-ink">Nhắc nhở học tập qua Gmail</h2>
          </div>
          <p className="text-xs text-ink-soft leading-relaxed">
            Nhận email chứa các từ vựng cần ôn tập trực tiếp vào hộp thư Gmail của bạn. Hiện tại cần bấm nút bên
            dưới để gửi — gửi tự động mỗi ngày sẽ có ở bản sau.
          </p>

          {loadingStatus ? (
            <div className="flex items-center gap-2 text-xs text-ink-soft py-2">
              <Loader2 className="w-4 h-4 animate-spin text-green" />
              Đang kiểm tra kết nối...
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
                  Ngắt
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
                    Đang gửi email...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Gửi email nhắc học thử ngay
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
                Kết nối tài khoản Gmail
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
            Chủ đề lĩnh vực làm việc (Định hướng câu ví dụ AI):
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
          <label className="block text-xs font-mono-utility text-ink-soft mb-2">
            Trình độ tiếng Anh mục tiêu:
          </label>
          <select
            value={settings.level}
            onChange={(e) => updateSettings({ level: e.target.value as UserSettings['level'] })}
            className="w-full p-3 rounded-xl bg-paper border border-rule text-sm text-ink"
          >
            <option value="B1">B1 — Intermediate</option>
            <option value="B2">B2 — Upper-Intermediate</option>
            <option value="C1">C1 — Advanced</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-mono-utility text-ink-soft mb-2">Giao diện:</label>
          <div className="flex gap-2">
            <button
              onClick={() => updateSettings({ theme: 'light' })}
              className={`flex-1 py-2.5 rounded-xl border text-xs font-medium cursor-pointer ${
                settings.theme === 'light'
                  ? 'border-green bg-green-wash text-green'
                  : 'border-rule bg-paper text-ink-soft'
              }`}
            >
              Giao diện Sáng
            </button>
            <button
              onClick={() => updateSettings({ theme: 'dark' })}
              className={`flex-1 py-2.5 rounded-xl border text-xs font-medium cursor-pointer ${
                settings.theme === 'dark'
                  ? 'border-green bg-green-wash text-green'
                  : 'border-rule bg-paper text-ink-soft'
              }`}
            >
              Giao diện Tối
            </button>
          </div>
        </div>

        <Link
          href="/calendar"
          className="flex items-center justify-between p-4 rounded-2xl bg-surface border border-rule hover:border-green transition-colors"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Calendar size={18} className="text-green" />
            Kế hoạch học
          </span>
          <ChevronRight size={18} className="text-ink-soft" />
        </Link>
      </div>
    </>
  );
}

