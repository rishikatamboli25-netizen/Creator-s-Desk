import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, Check, X } from 'lucide-react';

export default function ActionGuard({
  open,
  variant = 'confirm',
  title,
  description,
  details,
  actionLabel = 'Confirm',
  cancelLabel = 'Cancel',
  processing = false,
  error = '',
  onConfirm,
  onCancel,
}) {
  const [progress, setProgress] = useState(0);
  const [triggered, setTriggered] = useState(false);
  const confirmButtonRef = useRef(null);
  const sliderRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setProgress(0);
      setTriggered(false);
      return;
    }
    setTriggered(false);
    setProgress(0);
    const timer = window.setTimeout(() => {
      if (variant === 'slide') sliderRef.current?.focus();
      else confirmButtonRef.current?.focus();
    }, 40);
    return () => window.clearTimeout(timer);
  }, [open, variant]);

  useEffect(() => {
    if (!processing && triggered) {
      setProgress(0);
      setTriggered(false);
    }
  }, [processing, triggered]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !processing) {
        event.preventDefault();
        onCancel?.();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onCancel, processing]);

  if (!open) return null;

  const confirm = () => {
    if (processing) return;
    onConfirm?.();
  };

  const handleSlide = (event) => {
    const next = Number(event.target.value);
    setProgress(next);
    if (next >= 100 && !triggered && !processing) {
      setTriggered(true);
      onConfirm?.();
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/35 p-4" role="presentation">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close confirmation"
        onClick={() => !processing && onCancel?.()}
      />

      <section
        className="relative z-10 w-full max-w-md border border-creator-border bg-creator-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="action-guard-title"
        aria-describedby="action-guard-description"
      >
        <div className="flex items-start gap-3 border-b border-creator-border px-6 py-5">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center border border-amber-200 bg-amber-50 text-amber-800">
            <AlertTriangle size={17} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-4">
              <h2 id="action-guard-title" className="text-base font-semibold text-creator-black">{title}</h2>
              <button
                type="button"
                onClick={() => !processing && onCancel?.()}
                disabled={processing}
                className="rounded-md border border-creator-border p-1.5 text-creator-muted hover:bg-creator-surface disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Cancel action"
              >
                <X size={15} />
              </button>
            </div>
            <p id="action-guard-description" className="mt-2 text-sm leading-6 text-creator-muted">{description}</p>
          </div>
        </div>

        {details ? (
          <div className="mx-6 mt-5 border border-creator-border bg-creator-surface px-4 py-3 text-sm text-creator-black">
            {details}
          </div>
        ) : null}

        {error ? (
          <div className="mx-6 mt-4 border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-700" role="alert">
            {error}
          </div>
        ) : null}

        {variant === 'slide' ? (
          <div className="space-y-4 px-6 py-6">
            <div className="border border-creator-border bg-creator-surface p-4">
              <div className="flex items-center justify-between gap-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-creator-faint">
                <span>Deliberate action</span>
                <span>{progress === 100 ? 'Ready' : 'Slide to confirm'}</span>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center border border-creator-border bg-creator-white text-creator-black">
                  {progress === 100 ? <Check size={18} /> : <ArrowRight size={18} />}
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={progress}
                  onChange={handleSlide}
                  disabled={processing}
                  aria-label={`Slide to ${actionLabel.toLowerCase()}`}
                  ref={sliderRef}
                  className="h-2 w-full cursor-pointer accent-black disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              <p className="mt-3 text-xs leading-5 text-creator-muted">
                You can also use the arrow keys or the End key after focusing the slider.
              </p>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={onCancel}
                disabled={processing}
                className="border border-creator-border px-4 py-2.5 text-sm font-medium text-creator-muted hover:bg-creator-surface disabled:opacity-40"
              >
                {cancelLabel}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end gap-3 px-6 py-6">
            <button
              type="button"
              onClick={onCancel}
              disabled={processing}
              className="border border-creator-border px-4 py-2.5 text-sm font-medium text-creator-muted hover:bg-creator-surface disabled:opacity-40"
            >
              {cancelLabel}
            </button>
            <button
              ref={confirmButtonRef}
              type="button"
              onClick={confirm}
              disabled={processing}
              className="inline-flex items-center gap-2 bg-creator-black px-4 py-2.5 text-sm font-semibold text-creator-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {processing ? 'Working…' : actionLabel}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
