'use client'
import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import Timer from '@/components/Timer'

const TIER_CONFIG = {
  easy: { label: 'Easy', color: 'text-green-400', border: 'border-green-400/30', pts: 100 },
  medium: { label: 'Medium', color: 'text-yellow-400', border: 'border-yellow-400/30', pts: 250 },
  hard: { label: 'Hard', color: 'text-red-400', border: 'border-red-400/30', pts: 500 }
}

export default function Sidebar({ session }) {
  const [levels, setLevels] = useState([])
  const [totalPoints, setTotalPoints] = useState(0)
  const [open, setOpen] = useState({ easy: true, medium: true, hard: true })
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    fetch('/api/progress')
      .then(r => r.json())
      .then(data => {
        setLevels(data.levels || [])
        setTotalPoints(data.totalPoints || 0)
      })
  }, [pathname])

  const grouped = {
    easy: levels.filter(l => l.tier === 'easy'),
    medium: levels.filter(l => l.tier === 'medium'),
    hard: levels.filter(l => l.tier === 'hard')
  }

  return (
    <aside
      style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)' }}
      className="w-72 border-r border-white/10 flex flex-col h-screen shrink-0"
    >
      {/* Team info + score */}
      <div className="px-5 py-5 border-b border-white/10">
        <p className="text-purple-400 font-mono text-xs tracking-widest mb-1">
          &gt; PROMPT BREAKER
        </p>
        <p className="text-white font-mono text-sm font-bold">
          {session?.user?.name}
        </p>
        <p className="text-white/30 font-mono text-xs mb-3">
          {session?.user?.college}
        </p>

        {/* Score card */}
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl px-4 py-3 mb-3">
          <p className="text-purple-300 font-mono text-xs tracking-widest mb-1">
            TOTAL SCORE
          </p>
          <p className="text-white font-mono text-2xl font-bold leading-none">
            {totalPoints.toLocaleString()}
            <span className="text-purple-400 text-sm font-normal ml-1">pts</span>
          </p>
        </div>
        {/* Timer */}
        <Timer />
      </div>

      {/* Level navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-2">
        {['easy', 'medium', 'hard'].map(tier => {
          const cfg = TIER_CONFIG[tier]
          const tierLvl = grouped[tier]
          const solved = tierLvl.filter(l => l.status === 'solved').length
          const tierPts = tierLvl.reduce((sum, l) => sum + (l.points_earned || 0), 0)

          return (
            <div key={tier}>
              {/* Tier accordion header */}
              <button
                onClick={() => setOpen(prev => ({ ...prev, [tier]: !prev[tier] }))}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg
                            border ${cfg.border} hover:bg-white/5 transition-colors`}
              >
                <div className="flex items-center gap-2">
                  <span className={`font-mono text-xs font-bold tracking-widest ${cfg.color}`}>
                    {cfg.label.toUpperCase()}
                  </span>
                  <span className="text-white/20 font-mono text-xs">
                    {cfg.pts} pts each
                  </span>
                </div>
                <span className="text-white/40 font-mono text-xs">
                  {solved}/{tierLvl.length}
                </span>
              </button>

              {/* Tier point total */}
              {tierPts > 0 && (
                <p className={`font-mono text-xs px-3 mt-0.5 ${cfg.color} opacity-70`}>
                  {tierPts} pts earned
                </p>
              )}

              {/* Level list */}
              {open[tier] && (
                <div className="mt-1 space-y-1 pl-2">
                  {tierLvl.map(level => {
                    const isActive = pathname === `/arena/${level.id}`
                    const isSolved = level.status === 'solved'

                    return (
                      <button
                        key={level.id}
                        onClick={() => router.push(`/arena/${level.id}`)}
                        className={`w-full text-left px-3 py-2 rounded-lg font-mono text-xs
                                    flex items-center justify-between transition-colors
                                    hover:bg-white/5 cursor-pointer
                                    ${isActive ? 'bg-purple-600/30 border border-purple-500/40' : ''}
                        `}
                      >
                        <span className="text-white/80 truncate">
                          {level.order_index.toString().padStart(2, '0')}. {level.agent_name}
                        </span>
                        <span className="ml-2 shrink-0 flex items-center gap-1.5">
                          {isSolved ? (
                            <>
                              <span className={`text-xs ${cfg.color}`}>
                                +{level.level_points}
                              </span>
                              <span className="text-green-400">✓</span>
                            </>
                          ) : (
                            <span className={`text-xs opacity-40 ${cfg.color}`}>
                              {level.level_points} pts
                            </span>
                          )}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Leaderboard link */}
      <div className="px-5 py-3 border-t border-white/10">
        <a
          href="/leaderboard"
          target="_blank"
          className="w-full text-white/30 hover:text-purple-400 font-mono text-xs
               py-1 transition-colors flex items-center gap-2"
        >
          <span>&gt;</span>
          <span>VIEW LEADERBOARD</span>
        </a>
      </div>



      {/* Logout */}
      <div className="px-5 py-4 border-t border-white/10">
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full text-white/30 hover:text-red-400 font-mono text-xs
                     py-2 transition-colors text-left"
        >
          &gt; DISCONNECT SESSION
        </button>
      </div>
    </aside>
  )
}