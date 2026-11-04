// components/ChatbotToggle.tsx
"use client";

import React, { useState, useCallback, FC } from "react";
import Chatbot from "./Chatbot";

interface ChatbotToggleProps {
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  theme?: "light" | "dark" | "auto";
}

const ChatbotToggle: FC<ChatbotToggleProps> = ({
  position = "bottom-right",
  theme = "auto",
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  // ============== TOGGLE CHAT ==============
  const toggleChat = useCallback((): void => {
    setIsOpen((prev) => !prev);
  }, []);

  return (
    <>
      {/* Dream More brand accent */}
      <button
        onClick={toggleChat}
        aria-label={isOpen ? "Close chat" : "Open chat"}
        className={`
          fixed bottom-6 right-4 sm:right-6 md:right-8 z-50
          w-14 h-14 rounded-full shadow-2xl
          flex items-center justify-center
          transition-all duration-300 transform
          ${
            isOpen
              ? "bg-red-500 hover:bg-red-600 rotate-90"
              : "bg-[#EB6D3D] hover:bg-[#cf5427] hover:scale-110 hover:shadow-[#EB6D3D]/40"
          }
          text-white text-2xl
          group
        `}
      >
        {isOpen ? (
          <svg
            className="w-6 h-6"
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
        ) : (
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        )}
      </button>

      {/* Chatbot Component */}
      <Chatbot
        isOpen={isOpen}
        onToggle={toggleChat}
        position={position}
        theme={theme}
      />
    </>
  );
};

export default ChatbotToggle;