'use client';

import React, { useState } from 'react';
import { useProfile } from '@/hooks/use-profile';
import { useSettingsStore } from '@/stores/settings-store';
import { Button } from '@/components/Button';
import { Sheet } from '@/components/Sheet';
import { Calendar, Video, Mail, CheckCircle2, User } from 'lucide-react';
import { Tutor, Session } from '@/types';

// Ported from screens/ScheduleScreen.tsx (Phase 2 — routing only, logic unchanged;
// this screen is a mock end-to-end per docs/progress/00-baseline-audit.md — real
// Calendar/Meet integration is Phase 9+, see docs/progress/board.md).
const BASE_TIME = 1738800000000;

export default function SchedulePage() {
  const { settings } = useProfile();
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const [nowTimestamp] = useState(() => BASE_TIME);

  const tutors = React.useMemo<Tutor[]>(() => [
    {
      id: 't1',
      name: 'Minh Trang',
      email: 'minhtrang.english@example.com',
      photoUrl: 'https://picsum.photos/seed/tutor1/100/100',
      bio: 'Giảng viên chuyên Tiếng Anh Công sở & Viết Email Doanh nghiệp (IELTS 8.5).',
      availableSlots: [nowTimestamp + 86400000 * 2 + 3600000 * 10, nowTimestamp + 86400000 * 4 + 3600000 * 14],
    },
    {
      id: 't2',
      name: 'Alex Rivera',
      email: 'alex.rivera@example.com',
      photoUrl: 'https://picsum.photos/seed/tutor2/100/100',
      bio: 'Senior Software Engineer & Tech Communication Coach.',
      availableSlots: [nowTimestamp + 86400000 * 3 + 3600000 * 15],
    },
  ], [nowTimestamp]);

  const [sessions, setSessions] = useState<Session[]>(() => [
    {
      id: 's1',
      tutorId: 't1',
      tutorName: 'Minh Trang',
      startsAt: BASE_TIME + 86400000 * 2 + 3600000 * 10,
      meetUrl: 'https://meet.google.com/abc-defg-hij',
      status: 'upcoming',
    },
  ]);

  const [isBookSheetOpen, setIsBookSheetOpen] = useState(false);
  const [selectedTutor, setSelectedTutor] = useState<Tutor | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  const handleConfirmBooking = () => {
    if (!selectedTutor || !selectedSlot) return;

    const newSession: Session = {
      id: 's_' + Date.now(),
      tutorId: selectedTutor.id,
      tutorName: selectedTutor.name,
      startsAt: selectedSlot,
      meetUrl: 'https://meet.google.com/lexio-' + Math.random().toString(36).substring(2, 8),
      status: 'upcoming',
    };

    setSessions((prev) => [newSession, ...prev]);
    setBookingSuccess(true);
    setTimeout(() => {
      setBookingSuccess(false);
      setIsBookSheetOpen(false);
      setSelectedTutor(null);
      setSelectedSlot(null);
    }, 1200);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-rule">
          <h2 className="font-serif-display text-2xl text-ink">
            Buổi học với Giảng viên
          </h2>
          <Button variant="quiet" onClick={() => setIsBookSheetOpen(true)}>
            Đặt lịch mới
          </Button>
        </div>

        {sessions.length === 0 ? (
          <div className="p-6 rounded-[16px] bg-surface border border-rule text-center">
            <p className="text-sm text-ink-soft mb-3">
              Chưa có lịch học nào sắp tới. Hãy đặt buổi luyện nói 30 phút cuối tuần để thực hành các từ đã học.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((sess) => (
              <div
                key={sess.id}
                className="p-4 rounded-[16px] bg-surface border border-rule flex items-center justify-between gap-4"
              >
                <div>
                  <span className="font-serif-display text-xl text-ink block">
                    Buổi học với {sess.tutorName}
                  </span>
                  <span className="font-mono-utility text-xs text-ink-soft" suppressHydrationWarning>
                    {new Date(sess.startsAt).toLocaleString('vi-VN', {
                      weekday: 'short',
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                <a
                  href={sess.meetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-[12px] bg-green-wash text-green hover:bg-green hover:text-white transition-all text-xs font-medium inline-flex items-center gap-1.5"
                >
                  <Video size={14} />
                  Vào Meet
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-5 rounded-[16px] bg-surface border border-rule space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar size={20} className="text-green" />
            <h3 className="font-serif-display text-2xl text-ink">Lịch học lặp lại</h3>
          </div>
          <input
            type="time"
            value={settings.studyTime || '08:00'}
            onChange={(e) => updateSettings({ studyTime: e.target.value })}
            className="p-1.5 rounded-[8px] bg-paper border border-rule font-mono-utility text-xs text-ink"
          />
        </div>
        <p className="text-xs text-ink-soft leading-relaxed">
          Đặt nhắc nhở lặp lại 15 phút mỗi ngày trong Google Calendar để tạo thói quen học từ vựng bền vững.
        </p>
      </div>

      <div className="p-5 rounded-[16px] bg-surface border border-rule space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail size={20} className="text-green" />
            <h3 className="font-serif-display text-2xl text-ink">Email 5 từ sáng</h3>
          </div>
          <select
            value={settings.reminderHour === null ? 'off' : String(settings.reminderHour)}
            onChange={(e) =>
              updateSettings({
                reminderHour: e.target.value === 'off' ? null : Number(e.target.value),
              })
            }
            className="p-1.5 rounded-[8px] bg-paper border border-rule font-mono-utility text-xs text-ink"
          >
            <option value="off">Tắt</option>
            <option value="7">7:00 Sáng</option>
            <option value="8">8:00 Sáng</option>
            <option value="9">9:00 Sáng</option>
            <option value="20">20:00 Tối</option>
          </select>
        </div>
        <p className="text-xs text-ink-soft leading-relaxed">
          Gửi email 5 từ cần ôn tập đến hộp thư của bạn vào giờ đã chọn. Chỉ mất 3 phút để hoàn thành.
        </p>
      </div>

      <Sheet isOpen={isBookSheetOpen} onClose={() => setIsBookSheetOpen(false)} title="Đặt buổi học 30 phút">
        <div className="space-y-5">
          {bookingSuccess ? (
            <div className="py-8 text-center space-y-2">
              <CheckCircle2 size={48} className="text-green mx-auto animate-bounce" />
              <p className="font-serif-display text-2xl text-ink">Đã đặt buổi học thành công!</p>
              <p className="text-xs text-ink-soft">Link Google Meet đã được tạo và lưu vào lịch của bạn.</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <span className="block text-xs font-mono-utility text-ink-soft">1. Chọn Giảng viên:</span>
                <div className="space-y-2">
                  {tutors.map((tutor) => (
                    <button
                      key={tutor.id}
                      type="button"
                      onClick={() => {
                        setSelectedTutor(tutor);
                        setSelectedSlot(null);
                      }}
                      className={`w-full text-left p-3.5 rounded-[12px] border cursor-pointer transition-all flex items-start gap-3 ${
                        selectedTutor?.id === tutor.id
                          ? 'border-green bg-green-wash'
                          : 'border-rule bg-paper hover:border-green'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-rule overflow-hidden flex-shrink-0 flex items-center justify-center text-ink-soft">
                        <User size={20} />
                      </div>
                      <div>
                        <span className="font-serif-display text-xl text-ink block">{tutor.name}</span>
                        <p className="text-xs text-ink-soft mt-0.5">{tutor.bio}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {selectedTutor && (
                <div className="space-y-3 animate-fade-in">
                  <span className="block text-xs font-mono-utility text-ink-soft">
                    2. Chọn khung giờ khả dụng:
                  </span>
                  <div className="grid grid-cols-1 gap-2">
                    {selectedTutor.availableSlots.map((slot, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedSlot(slot)}
                        className={`p-3 rounded-[10px] text-xs font-mono-utility border text-center transition-all cursor-pointer ${
                          selectedSlot === slot
                            ? 'border-2 border-green bg-green text-white'
                            : 'border-rule bg-paper text-ink'
                        }`}
                      >
                        {new Date(slot).toLocaleString('vi-VN', {
                          weekday: 'short',
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <Button
                variant="primary"
                onClick={handleConfirmBooking}
                disabled={!selectedTutor || !selectedSlot}
                className="w-full mt-4"
              >
                Xác nhận đặt buổi & Tạo Google Meet
              </Button>
            </>
          )}
        </div>
      </Sheet>
    </div>
  );
}
