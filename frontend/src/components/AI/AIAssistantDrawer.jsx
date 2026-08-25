import { X, Send, Sparkles } from "lucide-react";
import ChatMessage from "./ChatMessage";

export default function AIAssistantDrawer({ open, onClose }) {
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ${
          open ? "opacity-100 visible" : "opacity-0 invisible"
        }`}
      />

      {/* Drawer */}
      <aside
        className={`fixed top-0 right-0 z-[999] flex h-screen w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100">
              <Sparkles className="h-5 w-5 text-indigo-600" />
            </div>

            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Creator's Desk AI
              </h2>
              <p className="text-sm text-red-500">
                Your workspace assistant
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-2 transition hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Chat */}
        <main className="flex-1 overflow-y-auto bg-gray-50 p-5">
          <div className="space-y-4">
            <ChatMessage sender="assistant">
              👋 Hi! I'm your Desk Builder AI.
              <br />
              <br />
              Tell me about your workspace and I'll recommend the perfect setup.
            </ChatMessage>
          </div>
        </main>

        {/* Input */}
        <footer className="border-t bg-white p-4">
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Describe your setup..."
              className="flex-1 rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />

            <button className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-700">
              <Send className="h-5 w-5" />
            </button>
          </div>
        </footer>
      </aside>
    </>
  );
}