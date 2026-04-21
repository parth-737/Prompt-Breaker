'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'

const TIER_COLORS = {
  easy: 'text-green-400  border-green-400/30  bg-green-400/10',
  medium: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10',
  hard: 'text-red-400    border-red-400/30    bg-red-400/10'
}



export default function ArenaPage() {
  const { levelId } = useParams()

  const [level, setLevel] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [historyLoad, setHistoryLoad] = useState(true)
  const [solved, setSolved] = useState(false)
  const [pointsEarned, setPointsEarned] = useState(0)
  const [error, setError] = useState('')
  const [charCount, setCharCount] = useState(0)

  const [timeExpired, setTimeExpired] = useState(false)

  useEffect(() => {
    async function checkTimer() {
      const res = await fetch('/api/timer')
      const data = await res.json()
      if (data.expired) setTimeExpired(true)
    }
    checkTimer()

    // Recheck every 30 seconds
    const interval = setInterval(checkTimer, 30000)
    return () => clearInterval(interval)
  }, [])

  const chatEndRef = useRef(null)
  const textareaRef = useRef(null)

  // Load level data and chat history when levelId changes
  useEffect(() => {
    setMessages([])
    setSolved(false)
    setPointsEarned(0)
    setError('')
    setInput('')
    setCharCount(0)
    setLevel(null)
    setHistoryLoad(true)

    // Fetch level info and chat history in parallel
    Promise.all([
      fetch(`/api/level/${levelId}`).then(r => r.json()),
      fetch(`/api/chat/${levelId}`).then(r => r.json())
    ])
      .then(([levelData, historyData]) => {
        if (levelData.level) {
          setLevel(levelData.level)
          if (levelData.level.status === 'solved') {
            setSolved(true)
            setPointsEarned(levelData.level.points_earned || levelData.level.points)
          }
        }

        // Map history rows to message format
        if (historyData.messages?.length > 0) {
          const mapped = historyData.messages.map(m => ({
            role: m.role,
            text: m.message,
            solved: false
          }))
          setMessages(mapped)
        }
      })
      .catch(() => setError('Failed to load level.'))
      .finally(() => setHistoryLoad(false))

  }, [levelId])

  // Auto scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || loading || solved) return

    // Add user message immediately to UI
    setMessages(prev => [...prev, { role: 'user', text: trimmed }])
    setInput('')
    setCharCount(0)
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ levelId, prompt: trimmed })
      })
      const data = await res.json()

      if (!res.ok) {
        // Remove the optimistic user message on error
        setMessages(prev => prev.slice(0, -1))
        setError(data.error || 'Something went wrong.')
        setLoading(false)
        return
      }

      // Add agent response
      setMessages(prev => [...prev, {
        role: 'agent',
        text: data.response,
        solved: data.solved,
        points: data.points
      }])

      if (data.solved) {
        setSolved(true)
        setPointsEarned(data.points)
      }

    } catch (err) {
      setMessages(prev => prev.slice(0, -1))
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
      textareaRef.current?.focus()
    }
  }

  function handleKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleSubmit(e)
    }
  }

  function handleInputChange(e) {
    setInput(e.target.value)
    setCharCount(e.target.value.length)
  }

  async function handleClearHistory() {
    if (!confirm('Clear your chat history for this level? Your progress and points are kept.')) return
    await fetch(`/api/chat/${levelId}`, { method: 'DELETE' })
    setMessages([])
  }

  // Loading skeleton
  if (!level || historyLoad) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <div className="flex gap-1 justify-center">
            <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
              style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
              style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
              style={{ animationDelay: '300ms' }} />
          </div>
          <p className="text-white/30 font-mono text-xs">LOADING AGENT...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Objective Card ── */}
      <div
        style={{ background: 'rgba(255,255,255,0.03)' }}
        className="border-b border-white/10 px-6 py-4 shrink-0"
      >
        <div className="flex items-start justify-between gap-6">

          {/* Left: agent info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className={`font-mono text-xs px-2 py-0.5 rounded border ${TIER_COLORS[level.tier]}`}>
                {level.tier.toUpperCase()}
              </span>
              <span className="text-white/30 font-mono text-xs">
                AGENT {String(level.order_index).padStart(2, '0')}
              </span>
              {solved && (
                <span className="font-mono text-xs px-2 py-0.5 rounded border
                                 text-green-400 border-green-400/40 bg-green-400/10">
                  SOLVED ✓
                </span>
              )}
              {messages.length > 0 && !solved && (
                <button
                  onClick={handleClearHistory}
                  className="font-mono text-xs text-white/20 hover:text-white/50
                             transition-colors ml-2"
                >
                  clear history
                </button>
              )}
            </div>
            <h2 className="text-white font-mono text-lg font-bold mb-1">
              &gt; {level.agent_name}
            </h2>
            <p className="text-white/50 font-mono text-xs leading-relaxed">
              {level.objective_text}
            </p>
          </div>

          {/* Right: points card */}
          <div className="shrink-0 text-right">
            <div className={`border rounded-xl px-4 py-3 min-w-[100px]
              ${solved
                ? 'border-green-500/40 bg-green-500/10'
                : 'border-white/10 bg-white/5'
              }`}
            >
              <p className="font-mono text-xs text-white/30 mb-0.5">
                {solved ? 'EARNED' : 'REWARD'}
              </p>
              <p className={`font-mono text-2xl font-bold
                ${solved ? 'text-green-400'
                  : level.tier === 'hard' ? 'text-red-400'
                    : level.tier === 'medium' ? 'text-yellow-400'
                      : 'text-green-400'
                }`}>
                {solved ? `+${pointsEarned}` : level.points}
              </p>
              <p className="font-mono text-xs text-white/30">pts</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Chat History ── */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

        {/* Empty state */}
        {messages.length === 0 && !solved && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div
              style={{ background: 'rgba(255,255,255,0.03)' }}
              className="border border-white/10 rounded-xl px-6 py-5 text-center max-w-md"
            >
              <p className="text-white/20 font-mono text-xs mb-2">
                AGENT ONLINE
              </p>
              <p className="text-white/50 font-mono text-sm mb-1">
                {level.agent_name} is waiting.
              </p>
              <p className="text-white/25 font-mono text-xs">
                Send a message to begin. Break its character to win.
              </p>
            </div>
          </div>
        )}

        {/* Already solved with no messages loaded */}
        {messages.length === 0 && solved && (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="border border-green-500/30 bg-green-500/10
                            rounded-xl px-6 py-5 text-center">
              <p className="text-green-400 font-mono text-sm mb-1 font-bold">
                ✓ LEVEL ALREADY SOLVED
              </p>
              <p className="text-white/30 font-mono text-xs">
                +{pointsEarned} points were awarded.
              </p>
            </div>
          </div>
        )}

        {/* Message bubbles */}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-2xl rounded-xl px-4 py-3 font-mono text-sm
                             leading-relaxed
              ${msg.role === 'user'
                ? 'bg-purple-600/20 border border-purple-500/30 text-white/90'
                : msg.solved
                  ? 'bg-green-500/10 border border-green-500/40 text-green-100'
                  : 'bg-white/5 border border-white/10 text-white/80'
              }`}
            >
              <p className="text-xs mb-2 opacity-40">
                {msg.role === 'user' ? '> YOU' : `> ${level.agent_name}`}
              </p>
              <p className="whitespace-pre-wrap break-words">{msg.text}</p>

              {/* Win banner */}
              {msg.solved && (
                <div className="mt-3 pt-3 border-t border-green-500/30">
                  <p className="text-green-400 text-xs font-bold tracking-wider">
                    ✓ CHARACTER BROKEN — LEVEL COMPLETE
                  </p>
                  <p className="text-green-300 text-xs mt-0.5">
                    +{msg.points} points awarded to your team
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="flex justify-start">
            <div
              style={{ background: 'rgba(255,255,255,0.04)' }}
              className="border border-white/10 rounded-xl px-4 py-3"
            >
              <p className="text-xs mb-2 opacity-40 font-mono">
                &gt; {level.agent_name}
              </p>
              <div className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce"
                  style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce"
                  style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce"
                  style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* ── Input Area ── */}
      {/* ── Input Area ── */}
      <div
        style={{ background: 'rgba(255,255,255,0.03)' }}
        className="border-t border-white/10 px-6 py-4 shrink-0"
      >
        {error && (
          <div className="mb-3 px-3 py-2 rounded-lg border
                    border-red-500/30 bg-red-500/10">
            <p className="text-red-400 font-mono text-xs">
              &gt; ERROR: {error}
            </p>
          </div>
        )}

        {/* Time expired state */}
        {timeExpired ? (
          <div className="text-center py-4 space-y-2">
            <div className="border border-red-500/30 bg-red-500/10
                      rounded-xl px-6 py-4 inline-block">
              <p className="text-red-400 font-mono text-sm font-bold">
                COMPETITION TIME ENDED
              </p>
              <p className="text-white/30 font-mono text-xs mt-1">
                No more submissions allowed.
                Your score has been recorded.
              </p>
            </div>
          </div>

        ) : solved ? (
          <div className="text-center py-3 space-y-1">
            <p className="text-green-400 font-mono text-sm font-bold">
              ✓ LEVEL COMPLETE — +{pointsEarned} POINTS EARNED
            </p>
            <p className="text-white/30 font-mono text-xs">
              Select another agent from the sidebar to continue
            </p>
          </div>

        ) : (
          <form onSubmit={handleSubmit}>
            <div className="flex gap-3 items-end">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-3 text-purple-400
                           font-mono text-sm select-none">
                  &gt;
                </span>
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your prompt to break the agent... (Ctrl+Enter to submit)"
                  rows={3}
                  maxLength={2000}
                  disabled={loading}
                  className="w-full bg-black/40 border border-white/10 rounded-xl
                       pl-8 pr-16 py-3 text-white font-mono text-sm
                       placeholder-white/20 resize-none
                       focus:outline-none focus:border-purple-500/50
                       disabled:opacity-50 transition-colors"
                />
                <span className={`absolute bottom-3 right-3 font-mono text-xs
            ${charCount > 1800 ? 'text-red-400' : 'text-white/20'}`}>
                  {charCount}/2000
                </span>
              </div>
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="shrink-0 bg-purple-600 hover:bg-purple-500
                     disabled:bg-purple-600/30 disabled:cursor-not-allowed
                     text-white font-mono text-sm px-5 py-3 rounded-xl
                     transition-colors"
              >
                {loading ? '...' : 'EXECUTE'}
              </button>
            </div>
            <p className="text-white/15 font-mono text-xs mt-2 text-right">
              Ctrl+Enter to submit · Max 2000 chars
            </p>
          </form>
        )}
      </div>
    </div>
  )
}