export default function ActionPanel({ prompt, onSelect }) {
  if (!prompt) return null;

  return (
    <div className="w-full rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden mb-3">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
        <span className="text-sm font-semibold text-gray-800">{prompt.title}</span>
      </div>
      <div className="flex flex-col">
        {prompt.options.map((opt, idx) => (
          <button
            key={idx}
            onClick={() => onSelect(opt.value)}
            className="flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors group"
          >
            <span className="flex items-center justify-center min-w-[24px] h-6 rounded-md bg-gray-100 text-gray-500 text-xs font-medium group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
              {idx + 1}
            </span>
            <span className="text-gray-700">{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}