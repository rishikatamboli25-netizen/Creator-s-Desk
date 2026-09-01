import { Send } from "lucide-react";
import { useState } from "react";

export default function ChatInput({
  onSend,
}) {
  const [text, setText] = useState("");

  const submit = () => {
    if (!text.trim()) return;

    onSend(text);

    setText("");
  };

  return (
    <div className="flex items-center gap-3">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        placeholder="Type your answer..."
        className="
          flex-1
          rounded-xl
          border
          border-gray-300
          px-4
          py-3
          outline-none
          focus:border-indigo-500
        "
      />

      <button
        onClick={submit}
        className="
          flex
          h-12
          w-12
          items-center
          justify-center
          rounded-xl
          bg-indigo-600
          text-white
          hover:bg-indigo-700
        "
      >
        <Send size={18} />
      </button>
    </div>
  );
}