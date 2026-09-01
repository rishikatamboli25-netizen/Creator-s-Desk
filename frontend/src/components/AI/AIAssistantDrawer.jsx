import { useState, useEffect, useRef } from "react";
import { Sparkles, X } from "lucide-react";
import ChatInput from "./ChatInput";
import ChatMessage from "./ChatMessage";
import ActionPanel from "./ActionPanel";
import ProductRecommendations from "./ProductRecommendations";

export default function AIAssistantDrawer({ open, onClose, onAddToCart }) {
  const [messages, setMessages] = useState([]);
  const [activePrompt, setActivePrompt] = useState(null); 
  
  // Start at the new fork in the road
  const stepRef = useRef("SETUP_OR_INDIVIDUAL"); 
  const dataRef = useRef({
    flowType: "", // Tracks "Bundle" vs "Individual"
    useCase: [],
    budget: 0,
    setupType: "New Setup", // Default to prevent backend errors on individual items
    existingProducts: [],
  });
  
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, activePrompt]);

  // 1. New Initial Fork Prompt
  useEffect(() => {
    if (open && messages.length === 0) {
      addAssistantMessage("Hi! I'm your Desk Setup AI. Are you looking for a complete bundled setup, or just specific individual products?");
      setActivePrompt({
        title: "What are you looking for today?",
        options: [
          { label: "Complete Bundled Setup", value: "Bundle" },
          { label: "Specific Individual Products", value: "Individual" },
        ]
      });
    }
  }, [open]);

  const addAssistantMessage = (text, component = null) => {
    setMessages((prev) => [...prev, { id: Date.now(), sender: "assistant", text, component }]);
  };

  const addUserMessage = (text) => {
    setMessages((prev) => [...prev, { id: Date.now(), sender: "user", text }]);
  };

  const handleUserInput = async (text) => {
    setActivePrompt(null); 
    addUserMessage(text);
    const currentStep = stepRef.current;

    // 2. Handle the Fork
    if (currentStep === "SETUP_OR_INDIVIDUAL") {
      dataRef.current.flowType = text;
      
      if (text === "Bundle") {
        stepRef.current = "USE_CASE";
        setTimeout(() => {
          addAssistantMessage("Let's build your perfect workspace. What will you primarily use it for?");
          setActivePrompt({
            title: "Select a primary use case:",
            options: [
              { label: "Coding or Tech", value: "Coding" },
              { label: "Gaming", value: "Gaming" },
              { label: "Trading", value: "Trading" },
              { label: "General Study", value: "Study" },
            ]
          });
        }, 500);
      } else {
        stepRef.current = "INDIVIDUAL_ITEMS";
        setTimeout(() => {
          addAssistantMessage("Got it. What specific items are you looking for? (e.g., wireless mouse, mechanical keyboard, type-c adaptor)");
        }, 500);
      }
      return;
    }

    // 3. New Individual Items State & Validation
    if (currentStep === "INDIVIDUAL_ITEMS") {
      stepRef.current = "VALIDATING_DOMAIN";
      dataRef.current.useCase = [`Looking for specific items: ${text}`];
      
      // Mask the latency with a conversational loading state
      addAssistantMessage("Let me check if we carry that... ⚡");

      try {
        const res = await fetch("http://localhost:5005/validate-domain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: text })
        });
        
        const validationData = await res.json();

        if (validationData.isValid === false) {
          stepRef.current = "INDIVIDUAL_ITEMS"; 
          addAssistantMessage(validationData.reason || "I can only help with tech and desk accessories. What else are you looking for?");
          return;
        }

        stepRef.current = "BUDGET";
        addAssistantMessage("Got it. What is your maximum budget for these items?");
      } catch (err) {
        stepRef.current = "BUDGET";
        addAssistantMessage("Got it. What is your maximum budget for these items?");
      }
      return;
    }

    // 4. Standard Use Case State
    if (currentStep === "USE_CASE") {
      dataRef.current.useCase = [text];
      stepRef.current = "BUDGET";
      setTimeout(() => {
        addAssistantMessage(`Got it. Designing for ${text}. What is your maximum budget for this setup?`);
        setActivePrompt({
          title: "Select a budget tier, or type your exact amount below:",
          options: [
            { label: "$150 (Starter)", value: "150" },
            { label: "$400 (Balanced)", value: "400" },
            { label: "$800 (Premium)", value: "800" },
            { label: "$1500+ (Ultimate)", value: "1500" },
          ]
        });
      }, 500);
      return;
    }

    // 5. Budget State (With decimal parsing fix)
    if (currentStep === "BUDGET") {
      const cleanText = text.replace(/[^0-9.]/g, ""); 
      const budgetNum = parseFloat(cleanText);

      if (isNaN(budgetNum) || budgetNum <= 0) {
        setTimeout(() => addAssistantMessage("Please enter a valid number for your budget (e.g., 50)."), 500);
        return;
      }
      dataRef.current.budget = budgetNum;
      
      // If Individual flow, skip the setup questions and fetch now
      if (dataRef.current.flowType === "Individual") {
        triggerBackendAnalysis();
        return;
      }

      // Otherwise, continue the Bundle flow
      stepRef.current = "SETUP_TYPE";
      setTimeout(() => {
        addAssistantMessage("Awesome budget.");
        setActivePrompt({
          title: "Are we building a completely new setup, or upgrading?",
          options: [
            { label: "Complete New Setup", value: "Complete New Setup" },
            { label: "Upgrading Current Setup", value: "Upgrading current setup" },
          ]
        });
      }, 500);
      return;
    }

    // 6. Setup Type State
    if (currentStep === "SETUP_TYPE") {
      dataRef.current.setupType = text;
      if (text.includes("Upgrade") || text.includes("Upgrading")) {
        stepRef.current = "EXISTING_GEAR";
        setTimeout(() => addAssistantMessage("What gear do you already have? (e.g., MacBook Pro, Keychron Keyboard)"), 500);
      } else {
        triggerBackendAnalysis();
      }
      return;
    }

    // 7. Existing Gear State
    if (currentStep === "EXISTING_GEAR") {
      dataRef.current.existingProducts = text.split(",").map(item => item.trim());
      triggerBackendAnalysis();
      return;
    }
  };

  const triggerBackendAnalysis = async () => {
    stepRef.current = "FETCHING";
    setTimeout(() => addAssistantMessage("Scanning the catalog... ⚡"), 500);

    try {
      const response = await fetch("http://localhost:5005/desk-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataRef.current),
      });
      
      const data = await response.json();
      stepRef.current = "DONE";
      
      addAssistantMessage(
        data.recommendations?.summary || "Here is what I found for you!", 
        <ProductRecommendations 
          data={data.recommendations} 
          onAddToCart={onAddToCart} 
        />
      );
    } catch (error) {
      stepRef.current = "DONE";
      addAssistantMessage("Sorry, I ran into an issue connecting to the catalog. Please try again later.");
    }
  };

  return (
    <>
      <div onClick={onClose} className={`fixed inset-0 z-[190] bg-black/40 transition-opacity duration-300 ${open ? "visible opacity-100" : "invisible opacity-0"}`} />
      <aside className={`fixed right-0 top-0 z-[200] flex h-screen w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}>
        
        <header className="flex shrink-0 items-center justify-between border-b bg-white px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100">
              <Sparkles className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Desk Setup AI</h2>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </header>

        <main ref={scrollRef} className="flex-1 overflow-y-auto bg-gray-50 p-6 space-y-5 scroll-smooth pb-10">
          {messages.map((message) => (
            <ChatMessage key={message.id} sender={message.sender}>
              {message.text}
              {message.component && message.component}
            </ChatMessage>
          ))}
        </main>

        <footer className="shrink-0 bg-white px-4 py-4 border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <ActionPanel prompt={activePrompt} onSelect={handleUserInput} />
          <ChatInput 
            onSend={handleUserInput} 
            disabled={stepRef.current === "VALIDATING_DOMAIN" || stepRef.current === "FETCHING" || stepRef.current === "DONE"} 
          />
        </footer>
      </aside>
    </>
  );
}