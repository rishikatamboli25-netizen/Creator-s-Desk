import { ChevronRight } from "lucide-react";

export default function OptionCard({ title, subtitle, onClick }) {
  return (
    <button
      onClick={onClick}
      className="
        group
        w-full
        flex items-center justify-between
        text-left
        rounded-xl
        border border-gray-200
        bg-white
        px-4 py-3
        hover:border-indigo-500
        hover:bg-indigo-50/50
        hover:shadow-sm
        transition-all duration-200
      "
    >
      <div>
        <div className="font-medium text-sm text-gray-900 group-hover:text-indigo-700 transition-colors">
          {title}
        </div>
        {subtitle && (
          <div className="text-xs text-gray-500 mt-0.5">
            {subtitle}
          </div>
        )}
      </div>
      <ChevronRight 
        size={16} 
        className="text-gray-400 group-hover:text-indigo-500 transition-colors group-hover:translate-x-1" 
      />
    </button>
  );
}