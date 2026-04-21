import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import pool from '@/lib/db'
import bcrypt from 'bcryptjs'


async function isAdmin() {

  const cookieStore = await cookies()
  const cookie = cookieStore.get('admin-session')

  return cookie?.value === process.env.ADMIN_PASSWORD
}
export async function GET() {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await pool.query(
    `SELECT
       t.id,
       t.team_id,
       t.team_name,
       t.college,
       t.created_at,
       COUNT(tp.id) FILTER (WHERE tp.status = 'solved')  AS levels_solved,
       COALESCE(SUM(tp.points_earned), 0)                AS total_points
     FROM teams t
     LEFT JOIN team_progress tp ON tp.team_id = t.id
     GROUP BY t.id, t.team_id, t.team_name, t.college, t.created_at
     ORDER BY total_points DESC, t.created_at ASC`
  )

  return NextResponse.json({ teams: result.rows })
}

export async function POST(req) {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { teamId, teamName, password, college, timerDuration } = await req.json()

  // ✅ Validation FIRST
  if (!teamId || !teamName || !password) {
    return NextResponse.json(
      { error: 'teamId, teamName and password are required' },
      { status: 400 }
    )
  }

  // ✅ Check for existing team
  const existing = await pool.query(
    'SELECT id FROM teams WHERE team_id = $1',
    [teamId]
  )
  if (existing.rows.length > 0) {
    return NextResponse.json(
      { error: `Team ID "${teamId}" already exists` },
      { status: 409 }
    )
  }

  // ✅ Hash password
  const passwordHash = await bcrypt.hash(password, 10)

  // ✅ Single insert with timerDuration
  const teamResult = await pool.query(
    `INSERT INTO teams (team_id, team_name, password_hash, college, timer_duration)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [teamId, teamName, passwordHash, college || '', timerDuration || 90]
  )
  const newTeamId = teamResult.rows[0].id

  // Unlock all levels for the new team
  const levels = await pool.query('SELECT id FROM levels')
  for (const level of levels.rows) {
    await pool.query(
      `INSERT INTO team_progress (team_id, level_id, status, unlocked_at)
       VALUES ($1, $2, 'unlocked', NOW())
       ON CONFLICT (team_id, level_id) DO NOTHING`,
      [newTeamId, level.id]
    )
  }

  return NextResponse.json({ ok: true, teamId })
}

