'use client';

import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/Button';

// Scoped to (tabs) — the parent layout (AppHeader + TabBar) stays mounted around
// this boundary, so a crash in one tab still leaves the user able to navigate to
// another instead of being stuck on a dead screen.
export default function TabsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="py-16 text-center space-y-4" role="alert">
      <AlertTriangle size={40} className="mx-auto text-wrong" />
      <h1 className="font-serif-display text-2xl text-ink">Đã có lỗi xảy ra</h1>
      <p className="text-sm text-ink-soft max-w-sm mx-auto">
        Màn hình này không tải được. Dữ liệu học của bạn vẫn an toàn trên máy.
      </p>
      {process.env.NODE_ENV === 'development' && error.digest && (
        <p className="font-mono-utility text-xs text-ink-soft">{error.digest}</p>
      )}
      <div className="flex gap-2 justify-center pt-2">
        <Button variant="quiet" onClick={() => router.push('/today')}>
          Về trang chủ
        </Button>
        <Button variant="primary" onClick={() => reset()}>
          Thử lại
        </Button>
      </div>
    </div>
  );
}
