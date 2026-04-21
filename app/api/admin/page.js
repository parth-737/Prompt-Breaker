'use client'

import { useState } from 'react'


export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ text: '', type: '' })
  const [activeTab, setActiveTab] = useState('teams')

  // New team form state
  const [newTeamId, setNewTeamId] = useState('')
  const [newTeamName, setNewTeamName] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newCollege, setNewCollege] = useState('')
  const [newTimerDuration, setNewTimerDuration] = useState('90')
  const [creating, setCreating] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setAuthError('')

    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })
      const data = await res.json()

      if (res.ok) {
        setAuthed(true)
        fetchTeams()
      } else {
        setAuthError(data.error || 'Wrong password.')
      }
    } catch (err) {
      setAuthError('Network error. Is the dev server running?')
    }
  }

  async function fetchTeams() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/teams')
      const data = await res.json()
      setTeams(data.teams || [])
    } catch (err) {
      showMessage('Failed to fetch teams.', 'error')
    } finally {
      setLoading(false)
    }
  }

  function showMessage(text, type = 'success') {
    setMessage({ text, type })
    setTimeout(() => setMessage({ text: '', type: '' }), 4000)
  }

  async function handleCreate(e) {
    e.preventDefault()
    setCreating(true)

    try {
      const res = await fetch('/api/admin/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: newTeamId,
          teamName: newTeamName,
          password: newPassword,
          college: newCollege,
          timerDuration: parseInt(newTimerDuration) || 90
        })
      })
      const data = await res.json()

      if (res.ok) {
        showMessage(`Team "${newTeamId}" registered successfully.`, 'success')
        setNewTeamId('')
        setNewTeamName('')
        setNewPassword('')
        setNewCollege('')
        fetchTeams()
      } else {
        showMessage(`Error: ${data.error}`, 'error')
      }
    } catch (err) {
      showMessage('Network error. Try again.', 'error')
    } finally {
      setCreating(false)
    }
  }

  async function handleReset(teamDbId, teamName) {
    if (!confirm(`Reset all progress for "${teamName}"? This cannot be undone.`)) return

    try {
      const res = await fetch(`/api/admin/teams/${teamDbId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' })
      })
      if (res.ok) {
        showMessage(`Progress reset for "${teamName}".`, 'success')
        fetchTeams()
      } else {
        showMessage('Failed to reset progress.', 'error')
      }
    } catch (err) {
      showMessage('Network error.', 'error')
    }
  }

  async function handleDelete(teamDbId, teamName) {
    if (!confirm(`PERMANENTLY DELETE "${teamName}"? This cannot be undone.`)) return

    try {
      const res = await fetch(`/api/admin/teams/${teamDbId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        showMessage(`Team "${teamName}" deleted.`, 'success')
        fetchTeams()
      } else {
        showMessage('Failed to delete team.', 'error')
      }
    } catch (err) {
      showMessage('Network error.', 'error')
    }
  }

  // ── Login screen ──
  if (!authed) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="w-full max-w-sm">

          <div className="text-center mb-8">
            <p className="text-red-400 font-mono text-xs tracking-widest mb-2">
              RESTRICTED ACCESS
            </p>
            <h1 className="text-white font-mono text-2xl font-bold">
              ADMIN PANEL
            </h1>
            <p className="text-white/20 font-mono text-xs mt-2">
              ORGANIZER ONLY · NOT FOR PARTICIPANTS
            </p>
          </div>

          <div
            style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(12px)' }}
            className="border border-white/10 rounded-2xl p-8"
          >
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-white/40 font-mono text-xs tracking-widest block mb-2">
                  ADMIN PASSWORD
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoFocus
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3
                             text-white font-mono text-sm placeholder-white/20
                             focus:outline-none focus:border-red-500/50 transition-colors"
                />
              </div>

              {authError && (
                <div className="border border-red-500/30 bg-red-500/10 rounded-xl px-4 py-3">
                  <p className="text-red-400 font-mono text-xs">
                    &gt; ERROR: {authError}
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={!password.trim()}
                className="w-full bg-red-700 hover:bg-red-600
                           disabled:bg-red-700/30 disabled:cursor-not-allowed
                           text-white font-mono text-sm py-3 rounded-xl
                           transition-colors"
              >
                &gt; ACCESS ADMIN PANEL
              </button>
            </form>
          </div>

          <p className="text-white/10 font-mono text-xs text-center mt-6">
            PROMPT Breaker · ORGANIZER DASHBOARD
          </p>
        </div>
      </main>
    )
  }

  // ── Admin dashboard ──
  const totalSolves = teams.reduce((s, t) => s + parseInt(t.levels_solved || 0), 0)
  const totalPoints = teams.reduce((s, t) => s + parseInt(t.total_points || 0), 0)

  return (
    <main className="min-h-screen bg-black text-white px-6 py-8">
      <div className="max-w-6xl mx-auto">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-red-400 font-mono text-xs tracking-widest mb-1">
              RESTRICTED · ORGANIZER ONLY
            </p>
            <h1 className="text-white font-mono text-2xl font-bold">
              ADMIN PANEL
            </h1>
          </div>
          <div className="flex gap-3">
            <button
              onClick={fetchTeams}
              className="border border-white/10 hover:border-white/30
                         text-white/40 hover:text-white font-mono text-xs
                         px-4 py-2 rounded-lg transition-colors"
            >
              &gt; REFRESH
            </button>
            <a

              href="/leaderboard"
              target="_blank"
              rel="noopener noreferrer"
              className="border border-purple-500/30 hover:border-purple-500/60
                         text-purple-400 font-mono text-xs
                         px-4 py-2 rounded-lg transition-colors"
            >
              &gt; LEADERBOARD
            </a>
            <a
              href="/arena"
              target="_blank"
              rel="noopener noreferrer"
              className="border border-white/10 hover:border-white/30
                         text-white/40 hover:text-white font-mono text-xs
                         px-4 py-2 rounded-lg transition-colors"
            >
              &gt; ARENA
            </a>
          </div>
        </div>

        {/* ── Stats bar ── */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'TEAMS REGISTERED', value: teams.length },
            { label: 'TOTAL SOLVES', value: totalSolves },
            { label: 'POINTS AWARDED', value: totalPoints.toLocaleString() }
          ].map(stat => (
            <div
              key={stat.label}
              style={{ background: 'rgba(255,255,255,0.03)' }}
              className="border border-white/10 rounded-xl px-5 py-4"
            >
              <p className="text-white/30 font-mono text-xs tracking-widest mb-1">
                {stat.label}
              </p>
              <p className="text-white font-mono text-2xl font-bold">
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* ── Status message ── */}
        {message.text && (
          <div className={`mb-6 px-4 py-3 rounded-xl border
            ${message.type === 'error'
              ? 'border-red-500/30 bg-red-500/10'
              : 'border-green-500/30 bg-green-500/10'
            }`}
          >
            <p className={`font-mono text-sm
              ${message.type === 'error' ? 'text-red-400' : 'text-green-400'}`}
            >
              &gt; {message.text}
            </p>
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="flex gap-2 mb-6">
          {[
            { key: 'teams', label: 'ALL TEAMS' },
            { key: 'register', label: 'REGISTER TEAM' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`font-mono text-xs px-4 py-2 rounded-lg border transition-colors
                ${activeTab === tab.key
                  ? 'bg-white/10 border-white/30 text-white'
                  : 'border-white/10 text-white/30 hover:text-white/60'
                }`}
            >
              &gt; {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab: All teams ── */}
        {activeTab === 'teams' && (
          <div
            style={{ background: 'rgba(255,255,255,0.03)' }}
            className="border border-white/10 rounded-2xl overflow-hidden"
          >
            {/* Table header */}
            <div className="grid grid-cols-12 px-6 py-3 border-b border-white/10 bg-white/3">
              <span className="col-span-2 text-white/30 font-mono text-xs tracking-widest">
                TEAM ID
              </span>
              <span className="col-span-3 text-white/30 font-mono text-xs tracking-widest">
                NAME
              </span>
              <span className="col-span-2 text-white/30 font-mono text-xs tracking-widest">
                COLLEGE
              </span>
              <span className="col-span-2 text-white/30 font-mono text-xs tracking-widest text-center">
                SOLVED
              </span>
              <span className="col-span-1 text-white/30 font-mono text-xs tracking-widest text-right">
                SCORE
              </span>
              <span className="col-span-2 text-white/30 font-mono text-xs tracking-widest text-right">
                ACTIONS
              </span>
            </div>

            {/* Loading state */}
            {loading ? (
              <div className="px-6 py-12 text-center">
                <div className="flex gap-1 justify-center mb-3">
                  <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                    style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                    style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                    style={{ animationDelay: '300ms' }} />
                </div>
                <p className="text-white/20 font-mono text-xs">LOADING TEAMS...</p>
              </div>
            ) : teams.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-white/20 font-mono text-sm">
                  &gt; NO TEAMS REGISTERED YET
                </p>
                <p className="text-white/10 font-mono text-xs mt-2">
                  Use the Register Team tab to add teams
                </p>
              </div>
            ) : (
              <>
                {teams.map((team) => {
                  const solved = parseInt(team.levels_solved || 0)
                  const points = parseInt(team.total_points || 0)

                  return (
                    <div
                      key={team.id}
                      className="grid grid-cols-12 px-6 py-4 border-b border-white/5
                                 hover:bg-white/3 transition-colors items-center"
                    >
                      {/* Team ID */}
                      <div className="col-span-2">
                        <span className="text-purple-400 font-mono text-xs font-bold">
                          {team.team_id}
                        </span>
                      </div>

                      {/* Team name */}
                      <div className="col-span-3">
                        <span className="text-white font-mono text-sm truncate block">
                          {team.team_name}
                        </span>
                      </div>

                      {/* College */}
                      <div className="col-span-2">
                        <span className="text-white/40 font-mono text-xs truncate block">
                          {team.college || '—'}
                        </span>
                      </div>

                      {/* Levels solved */}
                      <div className="col-span-2 text-center">
                        <span className={`font-mono text-sm
                          ${solved > 0 ? 'text-green-400' : 'text-white/20'}`}
                        >
                          {solved}/15
                        </span>
                      </div>

                      {/* Score */}
                      <div className="col-span-1 text-right">
                        <span className={`font-mono text-sm font-bold
                          ${points > 0 ? 'text-purple-400' : 'text-white/20'}`}
                        >
                          {points.toLocaleString()}
                        </span>
                      </div>

                      {/* Action buttons */}
                      <div className="col-span-2 flex justify-end gap-2">
                        <button
                          onClick={() => handleReset(team.id, team.team_name)}
                          className="text-yellow-400/60 hover:text-yellow-400
                                     border border-yellow-400/20 hover:border-yellow-400/50
                                     font-mono text-xs px-2 py-1 rounded
                                     transition-colors"
                        >
                          RESET
                        </button>
                        <button
                          onClick={() => handleDelete(team.id, team.team_name)}
                          className="text-red-400/60 hover:text-red-400
                                     border border-red-400/20 hover:border-red-400/50
                                     font-mono text-xs px-2 py-1 rounded
                                     transition-colors"
                        >
                          DELETE
                        </button>
                      </div>
                    </div>
                  )
                })}

                {/* Table footer */}
                <div className="px-6 py-3 border-t border-white/10
                                flex justify-between items-center">
                  <span className="text-white/20 font-mono text-xs">
                    {teams.length} team{teams.length !== 1 ? 's' : ''} registered
                  </span>
                  <span className="text-white/20 font-mono text-xs">
                    {totalSolves} total solve{totalSolves !== 1 ? 's' : ''} across all teams
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Tab: Register new team ── */}
        {activeTab === 'register' && (
          <div className="max-w-lg">
            <div
              style={{ background: 'rgba(255,255,255,0.03)' }}
              className="border border-white/10 rounded-2xl p-8"
            >
              <h2 className="text-white font-mono text-sm font-bold mb-6 tracking-widest">
                REGISTER NEW TEAM
              </h2>

              <form onSubmit={handleCreate} className="space-y-4">

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-white/40 font-mono text-xs tracking-widest block mb-2">
                      TEAM ID *
                    </label>
                    <input
                      type="text"
                      value={newTeamId}
                      onChange={e => setNewTeamId(e.target.value.toUpperCase())}
                      placeholder="TEAM_042"
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-xl
                                 px-4 py-3 text-white font-mono text-sm
                                 placeholder-white/20 focus:outline-none
                                 focus:border-purple-500/50 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-white/40 font-mono text-xs tracking-widest block mb-2">
                      PASSWORD *
                    </label>
                    <input
                      type="text"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="team-password"
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-xl
                                 px-4 py-3 text-white font-mono text-sm
                                 placeholder-white/20 focus:outline-none
                                 focus:border-purple-500/50 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-white/40 font-mono text-xs tracking-widest block mb-2">
                    TEAM NAME *
                  </label>
                  <input
                    type="text"
                    value={newTeamName}
                    onChange={e => setNewTeamName(e.target.value)}
                    placeholder="Alpha Squad"
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-xl
                               px-4 py-3 text-white font-mono text-sm
                               placeholder-white/20 focus:outline-none
                               focus:border-purple-500/50 transition-colors"
                  />
                </div>

                <div>
                  <label className="text-white/40 font-mono text-xs tracking-widest block mb-2">
                    COLLEGE
                  </label>
                  <input
                    type="text"
                    value={newCollege}
                    onChange={e => setNewCollege(e.target.value)}
                    placeholder="IIT Delhi"
                    className="w-full bg-white/5 border border-white/10 rounded-xl
                               px-4 py-3 text-white font-mono text-sm
                               placeholder-white/20 focus:outline-none
                               focus:border-purple-500/50 transition-colors"
                  />
                </div>

                <div>
                  <label className="text-white/40 font-mono text-xs tracking-widest block mb-2">
                    TIMER DURATION (MINUTES)
                  </label>
                  <input
                    type="number"
                    value={newTimerDuration}
                    onChange={e => setNewTimerDuration(e.target.value)}
                    placeholder="90"
                    min="1"
                    max="300"
                    className="w-full bg-white/5 border border-white/10 rounded-xl
               px-4 py-3 text-white font-mono text-sm
               placeholder-white/20 focus:outline-none
               focus:border-purple-500/50 transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={creating || !newTeamId || !newTeamName || !newPassword}
                  className="w-full bg-purple-600 hover:bg-purple-500
                             disabled:bg-purple-600/30 disabled:cursor-not-allowed
                             text-white font-mono text-sm py-3 rounded-xl
                             transition-colors mt-2"
                >
                  {creating ? '> REGISTERING...' : '> REGISTER TEAM'}
                </button>
              </form>
            </div>

            {/* Info box */}
            <div
              style={{ background: 'rgba(255,255,255,0.02)' }}
              className="border border-white/10 rounded-xl px-5 py-4 mt-4 space-y-2"
            >
              <p className="text-white/40 font-mono text-xs font-bold tracking-widest">
                NOTES
              </p>
              <p className="text-white/25 font-mono text-xs leading-relaxed">
                Team IDs are auto-uppercased. Passwords are shown in plain
                text here so you can hand them to teams — they are bcrypt
                hashed before being stored in the database.
              </p>
              <p className="text-white/25 font-mono text-xs leading-relaxed">
                All 15 levels are automatically unlocked for every new team
                the moment they are registered.
              </p>
            </div>
          </div>
        )}

      </div>
    </main>
  )
}