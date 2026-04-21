import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import pool from '@/lib/db'

async function isAdmin() {
  const cookieStore = await cookies()  
  const cookie      = cookieStore.get('admin-session')
  return cookie?.value === process.env.ADMIN_PASSWORD
}

export async function DELETE(req, { params }) {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  await pool.query('DELETE FROM prompt_submissions WHERE team_id = $1', [id])
  await pool.query('DELETE FROM team_progress WHERE team_id = $1',      [id])
  await pool.query('DELETE FROM teams WHERE id = $1',                   [id])

  return NextResponse.json({ ok: true })
}

export async function PATCH(req, { params }) {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id }     = await params
  const { action } = await req.json()

  if (action === 'reset') {
    await pool.query('DELETE FROM prompt_submissions WHERE team_id = $1', [id])
    await pool.query(
      `UPDATE team_progress
       SET status        = 'unlocked',
           solved_at     = NULL,
           points_earned = 0,
           attempts      = 0
       WHERE team_id = $1`,
      [id]
    )
    return NextResponse.json({ ok: true, message: 'Progress reset' })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}