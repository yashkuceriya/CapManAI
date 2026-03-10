'use client'

import { useState, useRef, useCallback } from 'react'
import { Send, Loader, X, AlertTriangle } from 'lucide-react'

interface ResponseInputProps {
  onSubmit: (response: string) => Promise<void>
  placeholder?: string
  isLoading?: boolean
  label?: string
}

export function ResponseInput({
  onSubmit,
  placeholder = 'Enter your response here...',
  isLoading = false,
  label = 'Your Response',
}: ResponseInputProps) {
  const [response, setResponse] = useState('')
  const [submitLoading, setSubmitLoading] = useState(false)
  const [pasteWarning, setPasteWarning] = useState(false)
  const typedCharsRef = useRef(0)
  const totalCharsRef = useRef(0)

  // Track typed vs pasted characters
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value
    const diff = newVal.length - response.length
    if (diff > 0 && diff <= 2) {
      // Likely typed (1 or 2 chars at a time)
      typedCharsRef.current += diff
    }
    totalCharsRef.current = newVal.length
    setResponse(newVal)
  }, [response])

  // Detect paste events
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const pastedText = e.clipboardData?.getData('text/plain') || ''
    // Flag if pasting a large block (>100 chars = likely AI-generated or copied)
    if (pastedText.length > 100) {
      setPasteWarning(true)
      // Auto-dismiss after 10s
      setTimeout(() => setPasteWarning(false), 10000)
    }
  }, [])

  const handleSubmit = async () => {
    if (!response.trim()) return
    setSubmitLoading(true)
    try {
      await onSubmit(response)
      setResponse('')
      typedCharsRef.current = 0
      totalCharsRef.current = 0
      setPasteWarning(false)
    } catch (error) {
      console.error('Failed to submit response:', error)
    } finally {
      setSubmitLoading(false)
    }
  }

  const isSubmitting = submitLoading || isLoading
  const charCount = response.length
  const minChars = 50

  return (
    <div className="space-y-3 animate-fade-in">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-semibold text-gray-300">{label}</label>
        <span className={`text-xs tabular-nums ${charCount >= minChars ? 'text-emerald-500' : 'text-gray-600'}`}>
          {charCount} chars {charCount < minChars && `(min ${minChars})`}
        </span>
      </div>

      {/* Paste warning banner */}
      {pasteWarning && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs"
          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#fbbf24' }}
        >
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Large paste detected.</span>{' '}
            Responses are analyzed for originality. Write your own analysis for the best learning experience and grade.
          </div>
          <button onClick={() => setPasteWarning(false)} className="ml-auto flex-shrink-0 opacity-60 hover:opacity-100">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      <div className="relative">
        <textarea
          value={response}
          onChange={handleChange}
          onPaste={handlePaste}
          disabled={isSubmitting}
          placeholder={placeholder}
          rows={6}
          className="textarea-field resize-none disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {/* Character progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-800 rounded-b-xl overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${charCount >= minChars ? 'bg-emerald-500' : 'bg-gray-600'}`}
            style={{ width: `${Math.min((charCount / 500) * 100, 100)}%` }}
          />
        </div>
      </div>

      <div className="flex gap-2 items-center">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !response.trim()}
          className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Submit Response
            </>
          )}
        </button>
        <button
          onClick={() => setResponse('')}
          disabled={isSubmitting || !response}
          className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed px-3"
          title="Clear"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
