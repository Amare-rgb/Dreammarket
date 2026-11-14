import React from "react";

interface LinkifyTextProps {
  text: string;
  className?: string;
}

/**
 * LinkifyText - Automatically detects URLs in text and renders them as clickable links.
 * Supports http://, https://, and www. prefixes.
 * Links open in new tab with proper security attributes.
 */
export function LinkifyText({ text, className = "" }: LinkifyTextProps) {
  if (!text) return null;

  // Create regex inside component to avoid shared state issues
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = urlRegex.exec(text)) !== null) {
    const url = match[0];
    const index = match.index;

    // Add text before the URL
    if (index > lastIndex) {
      parts.push(text.slice(lastIndex, index));
    }

    // Ensure URL has protocol for href
    const href = url.startsWith("www.") ? `https://${url}` : url;

    // Add the link
    parts.push(
      <a
        key={`link-${index}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 underline decoration-blue-600/50 underline-offset-2 transition-colors hover:text-blue-800 hover:decoration-blue-800"
      >
        {url}
      </a>
    );

    lastIndex = index + url.length;
  }

  // Add remaining text after last URL
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <span className={className}>{parts}</span>;
}

export default LinkifyText;
