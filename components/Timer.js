'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

export default function Timer() {
  const [timeRemaining, setTimeRemaining] = useState(null)
  const [totalTime,     setTotalTime]     = useState(null)
  const [expired,       setExpired]       = useState(false)
  const [loading,       setLoading]       = useState(true)
  const intervalRef = useRef(null)
  const router      = useRouter()

  // Fetch timer data from server on mount
  useEffect(() => {
    fetchTimer()
  }, [])

  async function fetchTimer() {
    try {
      const res  = await fetch('/api/timer')
      const data = await res.json()

      if (data.expired) {
        setExpired(true)
        setTimeRemaining(0)
        setTotalTime(data.totalTime)
        setLoading(false)
        return
      }

      setTimeRemaining(data.timeRemaining)
      setTotalTime(data.totalTime)
      setLoading(false)

      // Start local countdown
      startCountdown(data.timeRemaining)

    } catch (err) {
      console.error('Failed to fetch timer:', err)
      setLoading(false)
    }
  }

  function startCountdown(initialSeconds) {
    // Clear any existing interval
    if (intervalRef.current) clearInterval(intervalRef.current)

    let seconds = initialSeconds

    intervalRef.current = setInterval(() => {
      seconds -= 1

      if (seconds <= 0) {
        clearInterval(intervalRef.current)
        setTimeRemaining(0)
        setExpired(true)
        return
      }

      setTimeRemaining(seconds)
    }, 1000)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  // Format seconds into HH:MM:SS
  function formatTime(seconds) {
    if (seconds === null) return '--:--:--'
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return [
      String(h).padStart(2, '0'),
      String(m).padStart(2, '0'),
      String(s).padStart(2, '0')
    ].join(':')
  }

  // Calculate percentage remaining for progress bar
  const percentage = totalTime && timeRemaining !== null
    ? (timeRemaining / totalTime) * 100
    : 100

  // Color changes as time runs out
  const timerColor = expired          ? 'text-red-400'
    : percentage < 10                 ? 'text-red-400'
    : percentage < 25                 ? 'text-orange-400'
    : percentage < 50                 ? 'text-yellow-400'
    :                                   'text-green-400'

  const barColor = expired            ? 'bg-red-500'
    : percentage < 10                 ? 'bg-red-500'
    : percentage < 25                 ? 'bg-orange-500'
    : percentage < 50                 ? 'bg-yellow-500'
    :                                   'bg-green-500'

  if (loading) {
    return (
      <div className="px-3 py-2 rounded-lg border border-white/10">
        <p className="text-white/20 font-mono text-xs animate-pulse">
          --:--:--
        </p>
      </div>
    )
  }

  return (
    <div className={`rounded-lg border px-3 py-2
      ${expired
        ? 'border-red-500/40 bg-red-500/10'
        : 'border-white/10 bg-white/5'
      }`}
    >
      {/* Label */}
      <p className="text-white/30 font-mono text-xs tracking-widest mb-1">
        {expired ? 'TIME EXPIRED' : 'TIME REMAINING'}
      </p>

      {/* Time display */}
      <p className={`font-mono text-lg font-bold leading-none ${timerColor}`}>
        {expired ? '00:00:00' : formatTime(timeRemaining)}
      </p>

      {/* Progress bar */}
      <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${barColor}`}
          style={{ width: `${Math.max(0, percentage)}%` }}
        />
      </div>

      {/* Expired warning */}
      {expired && (
        <p className="text-red-400 font-mono text-xs mt-1">
          Competition ended
        </p>
      )}
    </div>
  )
}