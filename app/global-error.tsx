'use client';

// Only fires if the ROOT layout itself throws (app/layout.tsx) — must render its
// own <html>/<body> since the layout that would have provided them is what
// crashed. No `data-theme` is set here (the FOUC script lives in the layout this
// replaces), so tokens fall back to :root (light) — acceptable for a screen this
// rare.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="vi">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>
        <div
          style={{
            minHeight: '100dvh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            background: '#FAF8F5',
            color: '#232120',
            textAlign: 'center',
          }}
        >
          <div style={{ maxWidth: 360 }}>
            <h1 style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>Lexio gặp sự cố</h1>
            <p style={{ fontSize: '0.875rem', color: '#6B655E', marginBottom: '1rem' }}>
              Hãy tải lại trang. Nếu vẫn lỗi, dữ liệu của bạn vẫn nằm an toàn trong trình duyệt.
            </p>
            <button
              onClick={() => reset()}
              style={{
                background: '#2F6B4F',
                color: '#FAF8F5',
                border: 'none',
                borderRadius: 12,
                padding: '0.625rem 1.25rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Tải lại trang
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
