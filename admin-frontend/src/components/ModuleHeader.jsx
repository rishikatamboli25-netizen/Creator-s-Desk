import React from 'react';

export default function ModuleHeader({ eyebrow, title, description, action }) {
  return (
    <div className="mb-7 flex flex-col gap-4 border-b border-creator-border pb-6 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-creator-faint">{eyebrow}</div>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-creator-black md:text-3xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-creator-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}
