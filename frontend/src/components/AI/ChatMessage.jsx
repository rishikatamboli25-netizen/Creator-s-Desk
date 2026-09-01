export default function ChatMessage({ sender, children }) {
  const isUser = sender === "user";

  return (
    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[90%] rounded-2xl px-5 py-4 flex flex-col gap-2 ${
          isUser
            ? "bg-black text-white rounded-tr-sm"
            : "bg-white border border-gray-200 text-gray-900 shadow-sm rounded-tl-sm"
        }`}
      >
        <div className="whitespace-pre-wrap leading-relaxed">{children}</div>
      </div>
    </div>
  );
}