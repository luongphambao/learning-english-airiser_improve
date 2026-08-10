'use client';

import React from 'react';
import { useProfile } from '@/hooks/use-profile';
import { useSettingsStore } from '@/stores/settings-store';
import { BackHeader } from '@/components/layout/back-header';
import type { UserSettings } from '@/types';

// Extracted from the settings <Sheet> that used to live inside components/AppShell.tsx
// into a real page at /cai-dat (Phase 2 — routing), now on the settings-store (Phase
// 5). Same 3 fields, same behaviour; full settings redesign (reminder hour, data
// export/reset) is Phase 7 — see docs/progress/board.md.
export default function SettingsPage() {
  const { settings } = useProfile();
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  return (
    <>
      <BackHeader title="Cài đặt" />
      <div className="space-y-5 pt-6 max-w-md">
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
      </div>
    </>
  );
}
