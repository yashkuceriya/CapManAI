'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Loader, MessageCircle, Zap } from 'lucide-react'
import { renderInlineMarkdown } from '@/lib/sanitize'

interface Message {
  role: 'ai' | 'student'
  content: string
}

interface ProbeChatProps {
  messages: Message[]
  onAnswer: (answer: string) => Promise<void>
  isLoading?: boolean
  currentQuestion?: string
}

export function ProbeChat({
  messages,
  onAnswer,
  isLoading = false,
  currentQuestion,
}: ProbeChatProps) {
  const [answer, setAnswer] = useState('')
  const [submitLoading, setSubmitLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmitAnswer = async () => {
    if (!answer.trim()) return
    setSubmitLoading(true)
    try {
      await onAnswer(answer)
      setAnswer('')
    } catch (error) {
      console.error('Failed to submit answer:', error)
    } finally {
      setSubmitLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmitAnswer()
    }
  }

  const isSubmitting = submitLoading || isLoading

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Message History */}
      <div className="card max-h-[28rem] overflow-y-auto space-y-3 p-5">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-gray-600">
            <MessageCircle className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm">Probing questions will appear here...</p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3 animate-fade-in ${msg.role === 'student' ? 'justify-end' : ''}`}
              style={{ animationDelay: `${idx * 60}ms`, animationFillMode: 'both' }}
            >
              {msg.role === 'ai' && (
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0 mt-1">
                  <Zap className="w-3.5 h-3.5 text-emerald-400" />
                </div>
              )}
              <div
                className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${
                  msg.role === 'ai'
                    ? 'bg-gray-800/60 border border-gray-700/40 rounded-tl-md'
                    : 'bg-emerald-500/15 border border-emerald-500/20 rounded-tr-md'
                }`}
              >
                <p className={`text-sm leading-relaxed ${
                  msg.role === 'ai' ? 'text-gray-200' : 'text-emerald-200'
                }`}>
                  {renderInlineMarkdown(msg.content)}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Current Question Highlight */}
      {currentQuestion && (
        <div className="card-compact border-amber-500/20 bg-amber-500/[0.03] animate-fade-in">
          <p className="text-xs font-semibold text-amber-400 mb-1 uppercase tracking-wider">Current Question</p>
          <p className="text-sm text-gray-300 leading-relaxed">{currentQuestion}</p>
        </div>
      )}

      {/* Answer Input */}
      <div className="space-y-3">
        <div className="relative">
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSubmitting}
            placeholder="Type your answer... (Enter to send, Shift+Enter for new line)"
            rows={3}
            className="textarea-field resize-none disabled:opacity-50 disabled:cursor-not-allowed pr-14"
          />
          <button
            onClick={handleSubmitAnswer}
            disabled={isSubmitting || !answer.trim()}
            className="absolute bottom-3 right-3 w-9 h-9 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-gray-700 disabled:opacity-50 flex items-center justify-center transition-all duration-200"
          >
            {isSubmitting ? (
              <Loader className="w-4 h-4 text-gray-300 animate-spin" />
            ) : (
              <Send className="w-4 h-4 text-gray-950" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
