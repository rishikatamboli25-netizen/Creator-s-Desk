import React from 'react';
import { AlertCircle, CheckCircle2, LoaderCircle } from 'lucide-react';
import { toUserFacingMessage } from '../lib/userFacingError.js';

export function LoadingState({ label = 'Loading module data…' }) {
  return (
    <div className="flex min-h-64 items-center justify-center border border-creator-border bg-creator-white shadow-panel">
      <div className="flex items-center gap-3 text-sm text-creator-muted">
        <LoaderCircle size={17} className="animate-spin" />
        {label}
      </div>
    </div>
  );
}

export function ErrorState({ message }) {
  const safeMessage = toUserFacingMessage(message);
  return (
    <div className="flex min-h-64 items-center justify-center border border-red-200 bg-white shadow-panel">
      <div className="max-w-md px-6 text-center">
        <AlertCircle size={20} className="mx-auto text-red-600" />
        <div className="mt-3 text-sm font-semibold text-creator-black">Unable to load module data</div>
        <p className="mt-2 text-sm leading-6 text-creator-muted">{safeMessage}</p>
      </div>
    </div>
  );
}

export function ConnectedState({ label = 'Connected to service data' }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-creator-border bg-creator-white px-3 py-1.5 text-[11px] font-medium text-creator-muted">
      <CheckCircle2 size={13} />
      {label}
    </span>
  );
}

export function ModuleNotice({ title, description }) {
  return (
    <div className="border border-creator-border bg-creator-white p-6 shadow-panel">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 h-2.5 w-2.5 rounded-full bg-black" />
        <div>
          <div className="text-sm font-semibold text-creator-black">{title}</div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-creator-muted">{description}</p>
        </div>
      </div>
    </div>
  );
}
