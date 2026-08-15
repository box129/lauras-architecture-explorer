import { useRef, useEffect, useCallback, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { useSyntaxTreeStore } from '../../store';
import { useQueryStream } from './useQueryStream';
import MessageBubble from './MessageBubble';
import QueryInput from './QueryInput';
import type { QueryResponse } from '../../api/types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  response?: QueryResponse;
}

export default function QueryPanel() {
  const conversationId = useSyntaxTreeStore((s) => s.conversationId);
  const setConversationId = useSyntaxTreeStore((s) => s.setConversationId);
  const [messages, setMessages] = useState<Message[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { streaming, textChunks, complete, error, sendQuestion } = useQueryStream();

  // Build streaming text from chunks
  const streamingText = textChunks.join('');

  // When streaming completes, add assistant message
  useEffect(() => {
    if (complete) {
      const timer = window.setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            text: complete.answer_text,
            response: complete,
          },
        ]);

        if (complete.conversation_id) {
          setConversationId(complete.conversation_id);
        }
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [complete, setConversationId]);

  // Error message
  useEffect(() => {
    if (error) {
      const timer = window.setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: 'assistant',
            text: `Error: ${error}`,
          },
        ]);
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [error]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streamingText]);

  const handleSend = useCallback((question: string) => {
    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: 'user', text: question },
    ]);
    sendQuestion(question, conversationId || undefined);
  }, [conversationId, sendQuestion]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="h-10 bg-surface border-b border-border flex items-center px-3 gap-2 shrink-0">
        <MessageSquare size={14} className="text-secondary" />
        <span className="text-xs text-secondary font-medium">Query</span>
        {conversationId && (
          <span className="text-[10px] text-secondary/50 font-mono ml-auto truncate max-w-[100px]">
            {conversationId.slice(0, 8)}
          </span>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3">
        {messages.length === 0 && !streaming && (
          <div className="h-full flex flex-col items-center justify-center text-secondary gap-3">
            <MessageSquare size={32} className="opacity-30" />
            <p className="text-xs text-center">Ask questions about the codebase.<br />Try "What does UserService do?"</p>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            role={msg.role}
            text={msg.text}
            response={msg.response}
            onFollowUp={handleSend}
          />
        ))}

        {/* Streaming message */}
        {streaming && (
          <MessageBubble
            role="assistant"
            text={streamingText}
            streaming
          />
        )}
      </div>

      <QueryInput onSend={handleSend} disabled={streaming} />
    </div>
  );
}
