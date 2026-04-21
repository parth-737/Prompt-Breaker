import { getServerSession } from 'next-auth'
import { authOptions }      from '@/app/api/auth/[...nextauth]/route'
import pool                 from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const teamDbId = session.user.dbId

  // Get fresh data from DB
  const result = await pool.query(
    `SELECT session_start, timer_duration
     FROM teams WHERE id = $1`,
    [teamDbId]
  )
  const team = result.rows[0]

  if (!team?.session_start) {
    return Response.json({
      started:       false,
      timeRemaining: team?.timer_duration * 60 || 5400,
      totalTime:     team?.timer_duration * 60 || 5400,
      expired:       false
    })
  }

  const startTime    = new Date(team.session_start).getTime()
  const totalSeconds = (team.timer_duration || 90) * 60
  const elapsed      = Math.floor((Date.now() - startTime) / 1000)
  const remaining    = Math.max(0, totalSeconds - elapsed)

  return Response.json({
    started:       true,
    timeRemaining: remaining,
    totalTime:     totalSeconds,
    expired:       remaining === 0,
    sessionStart:  team.session_start
  })
}