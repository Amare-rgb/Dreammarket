"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Info, MessageSquare, Send, Smile, Trash2, User, X } from "lucide-react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const EMOJIS = ["😊", "😂", "🤔", "👍", "👋", "🧴", "📦", "♻️", "💚", "❤️", "🔥", "✨", "🎉", "💪", "🙏", "😎"];
const POSITION_MAP = {
  "bottom-right": "bottom-20 right-4 sm:right-6 md:right-8",
  "bottom-left": "bottom-20 left-4 sm:left-6 md:left-8",
  "top-right": "top-20 right-4 sm:right-6 md:right-8",
  "top-left": "top-20 left-4 sm:left-6 md:left-8",
} as const;

interface ChatMessage {
  id: string;
  text: string;
  sender: "user" | "bot";
  timestamp: string;
  isError?: boolean;
}

interface ChatHistoryMessage {
  id: string;
  userMessage: string;
  botResponse: string;
  timestamp: string;
  conversationId: string;
}

interface ChatHistoryResponse {
  success: boolean;
  data: { messages: ChatHistoryMessage[] };
}

interface ChatbotProps {
  isOpen: boolean;
  onToggle: () => void;
  position?: keyof typeof POSITION_MAP;
  theme?: "light" | "dark" | "auto";
}

function getAuthHeaders(): Record<string, string> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") || localStorage.getItem("authToken") : null;
  return { Authorization: `Bearer ${token || "demo-token"}` };
}

function formatTime(timestamp: string): string {
  try {
    const d = new Date(timestamp);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function createWelcomeMessages(): ChatMessage[] {
  const now = new Date().toISOString();
  const stamp = Date.now();
  return [
    { id: `welcome-${stamp}-1`, text: "👋 Hello! I'm your Dream More Affiliate Market assistant. How can I help you today?", sender: "bot", timestamp: now },
    { id: `welcome-${stamp}-2`, text: "I can help you explore marketplace listings, compare product details, or get support. What would you like to know?", sender: "bot", timestamp: now },
  ];
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-2 py-1">
      {[0, 150, 300].map((delay) => (
        <span key={delay} className="h-2 w-2 animate-bounce rounded-full bg-[#b98a3e]/60" style={{ animationDelay: `${delay}ms` }} />
      ))}
    </div>
  );
}

export default function Chatbot({ isOpen, onToggle, position = "bottom-right", theme = "auto" }: ChatbotProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const syncTheme = () => {
      if (theme === "dark") return setIsDarkMode(true);
      if (theme === "light") return setIsDarkMode(false);
      setIsDarkMode(window.matchMedia("(prefers-color-scheme: dark)").matches);
    };
    syncTheme();
    if (theme !== "auto") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, [theme]);

  const loadChatHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/chatbot/history?limit=30`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to load chat history");
      const data: ChatHistoryResponse = await res.json();
      if (data.success && data.data.messages.length > 0) {
        const items: ChatMessage[] = data.data.messages.flatMap((msg) => [
          { id: `${msg.id}-user`, text: msg.userMessage, sender: "user" as const, timestamp: msg.timestamp },
          { id: `${msg.id}-bot`, text: msg.botResponse, sender: "bot" as const, timestamp: msg.timestamp },
        ]);
        setMessages(items);
        setConversationId(data.data.messages[data.data.messages.length - 1]?.conversationId || null);
      } else {
        setMessages(createWelcomeMessages());
      }
    } catch (err) {
      console.error("Error loading chat history:", err);
      setMessages(createWelcomeMessages());
    } finally {
      setHasLoadedHistory(true);
    }
  }, []);

  useEffect(() => {
    if (!isOpen || hasLoadedHistory) return;
    const timer = setTimeout(() => void loadChatHistory(), 0);
    return () => clearTimeout(timer);
  }, [isOpen, hasLoadedHistory, loadChatHistory]);

  useEffect(() => {
    if (messages.length > 0) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!isOpen || isLoading) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, [isOpen, isLoading]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    setError(null);
    setInput("");
    setIsLoading(true);
    setIsTyping(true);
    setMessages((prev) => [...prev, { id: `user-${Date.now()}`, text, sender: "user", timestamp: new Date().toISOString() }]);

    try {
      const res = await fetch(`${API_BASE_URL}/api/chatbot/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ message: text, conversationId }),
      });
      setIsTyping(false);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to get response");
      }
      const data = await res.json();
      if (!data.success) throw new Error("Failed to process message");
      setConversationId(data.data.conversationId);
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          { id: `bot-${Date.now()}`, text: data.data.message, sender: "bot", timestamp: data.data.timestamp || new Date().toISOString() },
        ]);
      }, 300);
    } catch (err) {
      setIsTyping(false);
      setError(err instanceof Error ? err.message : "An error occurred");
      setMessages((prev) => [
        ...prev,
        { id: `error-${Date.now()}`, text: "Sorry, I encountered an error. Please try again. 😅", sender: "bot", timestamp: new Date().toISOString(), isError: true },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, conversationId]);

  const clearHistory = useCallback(async () => {
    if (!window.confirm("Clear all chat history?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/chatbot/history`, { method: "DELETE", headers: getAuthHeaders() });
      if (res.ok) {
        setMessages(createWelcomeMessages());
        setConversationId(null);
        setHasLoadedHistory(true);
      }
    } catch (err) {
      console.error("Error clearing history:", err);
    }
  }, []);

  if (!isOpen) return null;

  return (
    <div className={isDarkMode ? "dark" : ""}>
      <div className={`fixed ${POSITION_MAP[position] || POSITION_MAP["bottom-right"]} z-[9998] flex h-[400px] w-[90vw] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl transition-all duration-300 ease-in-out dark:border-gray-700 dark:bg-gray-800 sm:h-[450px] sm:w-[360px] md:h-[500px] md:w-[400px]`}>
        <div className="flex flex-shrink-0 items-center justify-between bg-gradient-to-r from-[#1a1410] via-[#2a1f18] to-[#3a2a1e] p-2.5 text-white">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-[#e0a83c]/40 bg-[#e0a83c]/20 text-base">🧴</div>
            <div className="min-w-0">
              <h3 className="truncate text-xs font-semibold">Dream More Assistant</h3>
              <div className="flex items-center gap-1 text-[10px] opacity-90">
                <span className="h-1.5 w-1.5 flex-shrink-0 animate-pulse rounded-full bg-[#e0a83c]" />
                <span>Online</span>
              </div>
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-0.5">
            <button type="button" onClick={() => void clearHistory()} className="rounded-full p-1.5 transition-colors hover:bg-white/20" title="Clear history" aria-label="Clear history">
              <Trash2 className="h-4 w-4" />
            </button>
            <button type="button" onClick={onToggle} className="rounded-full p-1.5 transition-colors hover:bg-white/20" aria-label="Close chat">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto scroll-smooth bg-[#faf6ee] p-3 dark:bg-gray-900">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-[#7a6a58] dark:text-gray-400">
              <div className="mb-3 text-4xl">🧴</div>
              <p className="text-center text-xs">Start a conversation with our AI assistant</p>
              <p className="mt-1 text-center text-[10px]">Ask about products, listings, or shopping support</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isUser = msg.sender === "user";
              return (
                <div key={msg.id} className={`flex gap-1.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
                  <div className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] ${isUser ? "bg-[#1a1410] text-[#e0a83c]" : msg.isError ? "bg-red-500 text-white" : "bg-gradient-to-r from-[#e0a83c] to-[#b98a3e] text-[#1a1410]"}`}>
                    {isUser ? <User className="h-3.5 w-3.5" /> : msg.isError ? "⚠️" : <MessageSquare className="h-3.5 w-3.5" />}
                  </div>
                  <div className={`max-w-[80%] rounded-xl px-3 py-1.5 text-xs ${isUser ? "rounded-tr-none bg-[#1a1410] text-white" : msg.isError ? "rounded-tl-none bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" : "rounded-tl-none border border-[#f0e8d8] bg-white text-[#1a1410] shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"}`}>
                    <div className="whitespace-pre-wrap break-words leading-relaxed">{msg.text}</div>
                    {msg.timestamp && <div className={`mt-1 text-[9px] ${isUser ? "text-[#e0a83c]/70" : "text-[#7a6a58] dark:text-gray-500"}`}>{formatTime(msg.timestamp)}</div>}
                  </div>
                </div>
              );
            })
          )}

          {isTyping && (
            <div className="flex gap-1.5">
              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-[#e0a83c] to-[#b98a3e] text-[#1a1410]">
                <MessageSquare className="h-3.5 w-3.5" />
              </div>
              <div className="rounded-xl rounded-tl-none border border-[#f0e8d8] bg-white px-3 py-2 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <TypingIndicator />
              </div>
            </div>
          )}

          {error && (
            <div className="flex justify-center">
              <div className="flex items-center gap-1.5 rounded-lg bg-red-100 px-3 py-1.5 text-[10px] text-red-700 dark:bg-red-900/30 dark:text-red-300">
                <Info className="h-3.5 w-3.5" />
                {error}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="flex flex-shrink-0 items-end gap-1.5 border-t border-[#f0e8d8] bg-white p-2 dark:border-gray-700 dark:bg-gray-800">
          <button type="button" onClick={() => setShowEmojiPicker((v) => !v)} className="flex-shrink-0 p-1.5 text-[#7a6a58] transition-colors hover:text-[#1a1410] dark:text-gray-400 dark:hover:text-gray-200" title="Add emoji" aria-label="Add emoji">
            <Smile className="h-5 w-5" />
          </button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendMessage();
              }
            }}
            placeholder="Type a message..."
            rows={1}
            disabled={isLoading}
            style={{ minHeight: "34px" }}
            className="max-h-24 flex-1 resize-none rounded-lg border border-[#f0e8d8] bg-white px-2.5 py-1.5 text-xs text-[#1a1410] focus:border-[#e0a83c] focus:outline-none focus:ring-1 focus:ring-[#e0a83c] disabled:cursor-not-allowed disabled:bg-[#faf6ee] dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:disabled:bg-gray-700"
          />
          <button
            type="button"
            onClick={() => void sendMessage()}
            disabled={!input.trim() || isLoading}
            aria-label="Send message"
            className={`flex flex-shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${!input.trim() || isLoading ? "cursor-not-allowed bg-gray-300 text-gray-500 dark:bg-gray-600 dark:text-gray-400" : "bg-[#EB6D3D] text-[#20283a] shadow-lg shadow-[#EB6D3D]/20 hover:bg-[#cf5427] hover:text-white active:scale-95"}`}
          >
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">{isLoading ? "..." : "Send"}</span>
          </button>
        </div>

        {showEmojiPicker && (
          <div className="flex flex-shrink-0 flex-wrap gap-0.5 border-t border-[#f0e8d8] bg-white p-1.5 dark:border-gray-700 dark:bg-gray-800">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  setInput((prev) => prev + emoji);
                  setShowEmojiPicker(false);
                  inputRef.current?.focus();
                }}
                className="rounded p-1 text-base transition-colors hover:bg-[#faf6ee] dark:hover:bg-gray-700"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}