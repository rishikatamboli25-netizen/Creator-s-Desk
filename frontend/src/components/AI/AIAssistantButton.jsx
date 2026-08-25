import { Sparkles } from "lucide-react";

export default function AIAssistantButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="
        fixed
        bottom-6
        right-6
        h-16
        w-16
        rounded-full
        bg-indigo-600
        hover:bg-indigo-700
        text-white
        shadow-2xl
        flex
        items-center
        justify-center
        transition
        duration-300
        z-50
      "
    >
      <Sparkles size={28} />
    </button>
  );
}