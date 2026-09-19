import React from 'react';

export default function PlaceholderPage({ title, eyebrow }) {
  return (
    <div className="mx-auto max-w-[1440px]">
      <div className="border border-creator-border bg-creator-white p-8 shadow-panel md:p-10">
        <div className="text-xs uppercase tracking-[0.18em] text-creator-faint">{eyebrow || 'Module'}</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-creator-black">{title}</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-creator-muted">
          This module is intentionally reserved for its domain implementation. The CD_ADMIN shell and authentication are already connected.
        </p>
        <div className="mt-8 border border-dashed border-creator-border bg-creator-surface px-5 py-6 text-sm text-creator-muted">
          Module foundation ready.
        </div>
      </div>
    </div>
  );
}
