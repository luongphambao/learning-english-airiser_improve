'use client';

import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/Button';

// Root-segment error boundary. All app data lives in the browser's own IndexedDB
// (docs/decision.md ADR-002), so a rendering crash never puts that data at risk —
// worth saying explicitly here since a scary error screen otherwise reads as
// "you lost your work".
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="min-h-dvh flex items-center justify-center p-6 bg-paper">
      <div className="text-center max-w-sm space-y-4">
        <AlertTriangle size={40} className="mx-auto text-wrong" />
        <h1 className="font-serif-display text-2xl text-ink">Đã có lỗi xảy ra</h1>
        <p className="text-sm text-ink-soft">
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
    </div>
  );
}
