'use client';

import React from 'react';
import { FileText, AlertTriangle, Upload } from 'lucide-react';

// Shared by both Learn modes ("Từ công việc" / "Từ tài liệu") — the file-drop box
// + paste textarea widget is identical between them, only `accept`/labels differ
// (docs/decision.md ADR-021). The two modes still handle the chosen file
// differently (FileReader vs a /api/parse-doc round trip), so this component only
// owns presentation; the file's onChange handler is the caller's.
interface UploadDropzoneProps {
  accept: string;
  hint: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileBusy?: boolean;
  fileError: string | null;
  pastedFileName: string | null;
  text: string;
  onTextChange: (value: string) => void;
  placeholder: string;
  maxLength?: number;
}

export function UploadDropzone({
  accept,
  hint,
  fileInputRef,
  onFile,
  fileBusy = false,
  fileError,
  pastedFileName,
  text,
  onTextChange,
  placeholder,
  maxLength = 10_000,
}: UploadDropzoneProps) {
  return (
    <div className="space-y-3">
      <div className="border-2 border-dashed border-rule rounded-card p-5 text-center hover:border-green transition-all">
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={onFile}
          disabled={fileBusy}
          className="hidden"
          id="doc-file-input"
        />
        <label htmlFor="doc-file-input" className="cursor-pointer block">
          <Upload size={28} className="mx-auto text-green mb-2" />
          <span className="text-sm font-medium text-ink block mb-1">
            {fileBusy ? 'Đang đọc tệp...' : hint}
          </span>
          <span className="text-xs text-ink-soft">Hoặc dán trực tiếp đoạn văn bên dưới</span>
        </label>
      </div>

      {fileError && (
        <p className="text-xs text-wrong flex items-center gap-1.5">
          <AlertTriangle size={14} />
          {fileError}
        </p>
      )}

      {pastedFileName && !fileError && (
        <p className="text-xs text-ink-soft flex items-center gap-1.5">
          <FileText size={14} />
          Đã nạp: {pastedFileName}
        </p>
      )}

      <textarea
        lang="en"
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder={placeholder}
        rows={10}
        maxLength={maxLength}
        className="w-full p-3.5 rounded-card bg-surface border border-rule text-sm text-ink focus:outline-none focus:border-green resize-none"
      />
      <p className="text-xs text-ink-soft text-right">
        {text.length}/{maxLength}
      </p>
    </div>
  );
}
