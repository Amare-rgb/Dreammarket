// components/Chatbot.tsx
"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  FC,
} from "react";

// ============== CONFIG ==============
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

function getAuthHeaders(): Record<string, string> {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("token") || localStorage.getItem("authToken")
      : null;
  return {
    Authorization: `Bearer ${token || "demo-token"}`,
  };
}

// ============== TYPES ==============
interface ChatMessage {
  id: string;
  text: string;
  sender: "user" | "bot";
  timestamp: string;
  isWelcome?: boolean;
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
  data: {
    messages: ChatHistoryMessage[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  };
}

interface ChatbotProps {
  isOpen: boolean;
  onToggle: () => void;
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  theme?: "light" | "dark" | "auto";
}

// ============== SVG ICONS ==============
const Icons = {
  Send: () => (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
      />
    </svg>
  ),
  Close: () => (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  ),
  Trash: () => (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  ),
  User: () => (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
        clipRule="evenodd"
      />
    </svg>
  ),
  Robot: () => (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
    </svg>
  ),
  Spinner: () => (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  ),
  Emoji: () => (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
  Info: () => (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
};

// ============== TYPING INDICATOR ==============
const TypingIndicator: FC = () => (
  <div className="flex items-center gap-1 px-2 py-1">
    <div className="flex gap-1">
      <span
        className="w-2 h-2 bg-[#b98a3e]/60 rounded-full animate-bounce"
        style={{ animationDelay: "0ms" }}
      ></span>
      <span
        className="w-2 h-2 bg-[#b98a3e]/60 rounded-full animate-bounce"
        style={{ animationDelay: "150ms" }}
      ></span>
      <span
        className="w-2 h-2 bg-[#b98a3e]/60 rounded-full animate-bounce"
        style={{ animationDelay: "300ms" }}
      ></span>
    </div>
  </div>
);

// ============== EMOJIS ==============
const EMOJIS = [
  "😊",
  "😂",
  "🤔",
  "👍",
  "👋",
  "🧴",
  "📦",
  "♻️",
  "💚",
  "❤️",
  "🔥",
  "✨",
  "🎉",
  "💪",
  "🙏",
  "😎",
];

// ============== MAIN CHATBOT COMPONENT ==============
const Chatbot: FC<ChatbotProps> = ({
  isOpen,
  onToggle,
  position = "bottom-right",
  theme = "auto",
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedHistory, setHasLoadedHistory] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ============== THEME DETECTION ==============
  useEffect(() => {
    const updateTheme = () => {
      if (theme === "dark") {
        setIsDarkMode(true);
      } else if (theme === "light") {
        setIsDarkMode(false);
      } else {
        const isDark = window.matchMedia(
          "(prefers-color-scheme: dark)"
        ).matches;
        setIsDarkMode(isDark);
      }
    };

    updateTheme();

    if (theme === "auto") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    }
  }, [theme]);

  // ============== SCROLL TO BOTTOM ==============
  const scrollToBottom = useCallback((): void => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // ============== ADD WELCOME MESSAGE ==============
  const addWelcomeMessage = useCallback((): void => {
    const welcomeMessages: ChatMessage[] = [
      {
        id: `welcome-${Date.now()}-1`,
        text: "👋 Hello! I'm your Dream More Affiliate Market assistant. How can I help you today?",
        sender: "bot",
        timestamp: new Date().toISOString(),
        isWelcome: true,
      },
      {
        id: `welcome-${Date.now()}-2`,
        text: "I can help you explore marketplace listings, compare product details, or get support. What would you like to know?",
        sender: "bot",
        timestamp: new Date().toISOString(),
        isWelcome: true,
      },
    ];
    setMessages(welcomeMessages);
    setHasLoadedHistory(true);
  }, []);

  // ============== LOAD CHAT HISTORY ==============
  const loadChatHistory = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/chatbot/history?limit=30`,
        {
          headers: getAuthHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to load chat history");
      }

      const data: ChatHistoryResponse = await response.json();

      if (data.success && data.data.messages.length > 0) {
        const historyMessages: ChatMessage[] = data.data.messages.flatMap(
          (msg) => [
            {
              id: `${msg.id}-user`,
              text: msg.userMessage,
              sender: "user" as const,
              timestamp: msg.timestamp,
            },
            {
              id: `${msg.id}-bot`,
              text: msg.botResponse,
              sender: "bot" as const,
              timestamp: msg.timestamp,
            },
          ]
        );
        setMessages(historyMessages);
        setConversationId(
          data.data.messages[data.data.messages.length - 1]?.conversationId ||
            null
        );
        setHasLoadedHistory(true);
      } else {
        addWelcomeMessage();
      }
    } catch (error) {
      console.error("Error loading chat history:", error);
      addWelcomeMessage();
    }
  }, [addWelcomeMessage]);

  // ============== LOAD HISTORY ON OPEN ==============
  useEffect(() => {
    let isMounted = true;
    let timerId: NodeJS.Timeout;

    if (isOpen && !hasLoadedHistory) {
      timerId = setTimeout(() => {
        if (isMounted) {
          loadChatHistory();
        }
      }, 0);
    }

    return () => {
      isMounted = false;
      if (timerId) clearTimeout(timerId);
    };
  }, [isOpen, hasLoadedHistory, loadChatHistory]);

  // ============== SCROLL TO BOTTOM ON MESSAGES CHANGE ==============
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom]);

  // ============== FOCUS INPUT ==============
  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (isOpen && !isLoading) {
      timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isOpen, isLoading]);

  // ============== SEND MESSAGE ==============
  const sendMessage = useCallback(
    async (messageText?: string): Promise<void> => {
      const text = messageText || input.trim();
      if (!text || isLoading) return;

      setError(null);

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        text: text,
        sender: "user",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setIsLoading(true);
      setIsTyping(true);

      try {
        const response = await fetch(`${API_BASE_URL}/api/chatbot/message`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            message: text,
            conversationId: conversationId,
          }),
        });

        setIsTyping(false);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to get response");
        }

        const data = await response.json();

        if (data.success) {
          setConversationId(data.data.conversationId);

          setTimeout(() => {
            const botMessage: ChatMessage = {
              id: `bot-${Date.now()}`,
              text: data.data.message,
              sender: "bot",
              timestamp: data.data.timestamp || new Date().toISOString(),
            };
            setMessages((prev) => [...prev, botMessage]);
          }, 300);
        } else {
          throw new Error("Failed to process message");
        }
      } catch (error) {
        console.error("Error sending message:", error);
        setIsTyping(false);
        setError(
          error instanceof Error ? error.message : "An error occurred"
        );

        const errorMessage: ChatMessage = {
          id: `error-${Date.now()}`,
          text: "Sorry, I encountered an error. Please try again. 😅",
          sender: "bot",
          timestamp: new Date().toISOString(),
          isError: true,
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [input, isLoading, conversationId]
  );

  // ============== HANDLE KEY PRESS ==============
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage]
  );

  // ============== FORMAT TIME ==============
  const formatTime = useCallback((timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return "";
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }, []);

  // ============== CLEAR HISTORY ==============
  const clearHistory = useCallback(async (): Promise<void> => {
    if (!window.confirm("Clear all chat history?")) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/chatbot/history`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        setMessages([]);
        addWelcomeMessage();
        setConversationId(null);
        setHasLoadedHistory(true);
      }
    } catch (error) {
      console.error("Error clearing history:", error);
    }
  }, [addWelcomeMessage]);

  // ============== ADD EMOJI ==============
  const addEmoji = useCallback((emoji: string): void => {
    setInput((prev) => prev + emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  }, []);

  // ============== GET POSITION CLASSES ==============
  const getPositionClasses = useCallback((): string => {
    const positions = {
      "bottom-right": "bottom-20 right-4 sm:right-6 md:right-8",
      "bottom-left": "bottom-20 left-4 sm:left-6 md:left-8",
      "top-right": "top-20 right-4 sm:right-6 md:right-8",
      "top-left": "top-20 left-4 sm:left-6 md:left-8",
    };
    return positions[position] || positions["bottom-right"];
  }, [position]);

  // ============== RENDER ==============
  if (!isOpen) return null;

  return (
    <div className={isDarkMode ? "dark" : ""}>
      <div
        className={`
          fixed ${getPositionClasses()}
          w-[90vw] sm:w-[360px] md:w-[400px] 
          bg-white dark:bg-gray-800 
          rounded-2xl shadow-2xl 
          flex flex-col overflow-hidden 
          z-[9998] transition-all duration-300 ease-in-out
          h-[400px] sm:h-[450px] md:h-[500px]
          border border-gray-200 dark:border-gray-700
        `}
      >
        {/* ===== HEADER — gold/navy/brown brand theme ===== */}
        <div
          className={`
            bg-gradient-to-r from-[#1a1410] via-[#2a1f18] to-[#3a2a1e]
            text-white p-2.5 flex items-center justify-between
            flex-shrink-0
          `}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 bg-[#e0a83c]/20 border border-[#e0a83c]/40 rounded-full flex items-center justify-center text-base flex-shrink-0">
              🧴
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-xs truncate">
                Dream More Assistant
              </h3>
              <div className="flex items-center gap-1 text-[10px] opacity-90">
                <span className="w-1.5 h-1.5 bg-[#e0a83c] rounded-full animate-pulse flex-shrink-0"></span>
                <span>Online</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                clearHistory();
              }}
              className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
              title="Clear history"
              aria-label="Clear history"
            >
              <Icons.Trash />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
              aria-label="Close chat"
            >
              <Icons.Close />
            </button>
          </div>
        </div>

        {/* ===== MESSAGES ===== */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-[#faf6ee] dark:bg-gray-900 scroll-smooth">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-[#7a6a58] dark:text-gray-400">
              <div className="text-4xl mb-3">🧴</div>
              <p className="text-xs text-center">
                Start a conversation with our AI assistant
              </p>
              <p className="text-[10px] text-center mt-1">
                Ask about products, listings, or shopping support
              </p>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div
                key={msg.id || index}
                className={`flex gap-1.5 animate-fadeIn ${
                  msg.sender === "user" ? "flex-row-reverse" : "flex-row"
                }`}
              >
                <div
                  className={`
                  w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px]
                  ${
                    msg.sender === "user"
                      ? "bg-[#1a1410] text-[#e0a83c]"
                      : msg.isError
                      ? "bg-red-500 text-white"
                      : "bg-gradient-to-r from-[#e0a83c] to-[#b98a3e] text-[#1a1410]"
                  }
                `}
                >
                  {msg.sender === "user" ? (
                    <Icons.User />
                  ) : msg.isError ? (
                    "⚠️"
                  ) : (
                    <Icons.Robot />
                  )}
                </div>
                <div
                  className={`
                  max-w-[80%] rounded-xl px-3 py-1.5
                  ${
                    msg.sender === "user"
                      ? "bg-[#1a1410] text-white rounded-tr-none text-xs"
                      : msg.isError
                      ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-tl-none text-xs"
                      : "bg-white dark:bg-gray-800 text-[#1a1410] dark:text-gray-200 rounded-tl-none shadow-sm border border-[#f0e8d8] dark:border-gray-700 text-xs"
                  }
                `}
                >
                  <div className="whitespace-pre-wrap break-words leading-relaxed">
                    {msg.text}
                  </div>
                  {msg.timestamp && (
                    <div
                      className={`
                      text-[9px] mt-1
                      ${
                        msg.sender === "user"
                          ? "text-[#e0a83c]/70"
                          : "text-[#7a6a58] dark:text-gray-500"
                      }
                    `}
                    >
                      {formatTime(msg.timestamp)}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {isTyping && (
            <div className="flex gap-1.5 animate-fadeIn">
              <div className="w-6 h-6 rounded-full bg-gradient-to-r from-[#e0a83c] to-[#b98a3e] text-[#1a1410] flex items-center justify-center flex-shrink-0 text-[10px]">
                <Icons.Robot />
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl rounded-tl-none px-3 py-2 shadow-sm border border-[#f0e8d8] dark:border-gray-700">
                <TypingIndicator />
              </div>
            </div>
          )}

          {error && (
            <div className="flex justify-center">
              <div className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-3 py-1.5 rounded-lg text-[10px] flex items-center gap-1.5">
                <Icons.Info />
                {error}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ===== INPUT AREA ===== */}
        <div className="p-2 bg-white dark:bg-gray-800 border-t border-[#f0e8d8] dark:border-gray-700 flex gap-1.5 items-end flex-shrink-0">
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-1.5 text-[#7a6a58] dark:text-gray-400 hover:text-[#1a1410] dark:hover:text-gray-200 transition-colors flex-shrink-0"
            title="Add emoji"
            aria-label="Add emoji"
          >
            <Icons.Emoji />
          </button>

          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            disabled={isLoading}
            className="flex-1 resize-none px-2.5 py-1.5 border border-[#f0e8d8] dark:border-gray-600 rounded-lg focus:outline-none focus:border-[#e0a83c] focus:ring-1 focus:ring-[#e0a83c] text-xs disabled:bg-[#faf6ee] dark:disabled:bg-gray-700 disabled:cursor-not-allowed max-h-24 bg-white dark:bg-gray-700 text-[#1a1410] dark:text-gray-100"
            style={{ minHeight: "34px" }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isLoading}
            className={`
              px-3 py-1.5 rounded-lg font-medium text-xs transition-all flex items-center gap-1.5 flex-shrink-0
              ${
                !input.trim() || isLoading
                  ? "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                  : "bg-[#EB6D3D] text-[#20283a] hover:bg-[#cf5427] hover:text-white active:scale-95 shadow-lg shadow-[#EB6D3D]/20"
              }
            `}
            aria-label="Send message"
          >
            {isLoading ? <Icons.Spinner /> : <Icons.Send />}
            <span className="hidden sm:inline">
              {isLoading ? "..." : "Send"}
            </span>
          </button>
        </div>

        {/* ===== EMOJI PICKER ===== */}
        {showEmojiPicker && (
          <div className="p-1.5 bg-white dark:bg-gray-800 border-t border-[#f0e8d8] dark:border-gray-700 flex flex-wrap gap-0.5 animate-fadeIn flex-shrink-0">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => addEmoji(emoji)}
                className="p-1 hover:bg-[#faf6ee] dark:hover:bg-gray-700 rounded transition-colors text-base"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Chatbot;