import Link from 'next/link';
import { Compass } from 'lucide-react';
import { Button } from '@/components/Button';

// Renders inside the root layout, not (tabs) — so there is no tab bar here; the
// link home is the only way out, which is why it must be present and prominent.
export default function NotFound() {
  return (
    <div className="min-h-dvh flex items-center justify-center p-6 bg-paper">
      <div className="text-center max-w-sm space-y-4">
        <Compass size={40} className="mx-auto text-ink-soft" />
        <h1 className="font-serif-display text-2xl text-ink">Không tìm thấy trang</h1>
        <p className="text-sm text-ink-soft">Đường dẫn bạn mở không tồn tại hoặc đã được đổi.</p>
        <Link href="/today">
          <Button variant="primary">Về trang chủ</Button>
        </Link>
      </div>
    </div>
  );
}
