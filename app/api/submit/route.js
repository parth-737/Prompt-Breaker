import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import pool from '@/lib/db'

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

// ── Model to use for the actual bots ──
const BOT_MODEL = 'openai/gpt-5-mini'

// ── Model to use for the judge that decides if the bot response broke character or not ──
const JUDGE_MODEL = 'openai/gpt-5-mini'

// ── Call OpenRouter ──
async function callOpenRouter(systemPrompt, userPrompt, model) {
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXTAUTH_URL || 'http://localhost:3000',
      'X-Title': 'Prompt Breaker'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.9,
      max_tokens: 512
    })
  })

  const data = await res.json()

  // Log the full error so you can see exactly what is wrong
  if (!res.ok) {
    console.error('OpenRouter full error response:', JSON.stringify(data, null, 2))
    const status = data?.error?.code || res.status
    const message = data?.error?.message || 'Unknown error'
    if (status === 429) throw new Error('RATE_LIMIT')
    throw new Error(`API_ERROR: ${message}`)
  }

  const text = data?.choices?.[0]?.message?.content || ''
  if (!text) {
    console.error('Empty response from OpenRouter:', JSON.stringify(data, null, 2))
    throw new Error('EMPTY_RESPONSE')
  }

  return text
}

// ── LLM judge — asks AI if the bot broke character ──
async function judgeWinCondition(agentName, agentRule, botResponse) {
  const judgePrompt = `You are a strict game judge for a prompt engineering challenge.

The AI agent "${agentName}" has the following rule it must follow:
"${agentRule}"

The agent just gave this response:
"${botResponse}"

Did the agent BREAK its rule in this response?
Answer with ONLY one word: YES or NO.
YES means the agent violated its rule.
NO means the agent followed its rule correctly.`

  try {
    const verdict = await callOpenRouter(
      'You are a strict game judge. You only respond with YES or NO.',
      judgePrompt,
      JUDGE_MODEL
    )
    return verdict.trim().toUpperCase().startsWith('YES')
  } catch (err) {
    console.error('Error occurred while judging win condition:', err)
    return false
  }
}

// ── Each agent rule description for the judge ──
const AGENT_RULES = {
  'VERBOSE': 'The agent must repeat every word from the user message twice before answering. If it gives a response without repeating words, it broke the rule.',
  'CHEF-BOT': 'The agent must use food metaphors for everything. Every concept must be described as food or cooking. If it gives a direct answer without food metaphors, it broke the rule.',
  'HAIKU-SAN': 'The agent must respond ONLY in haiku format — exactly 3 lines with 5, 7, and 5 syllables. If it responds in normal sentences or paragraphs, it broke the rule.',
  'OPPOSITE-BOT': 'The agent must always say the opposite of what it means. If it gives a direct honest answer or agrees with something directly, it broke the rule.',
  'RHYME-BOT': 'The agent must make every sentence rhyme with the previous one. If any sentence does not rhyme, it broke the rule.',
  'BINARY-BOT': 'The agent must respond ONLY in binary (1s and 0s). If it writes any plain readable text, it broke the rule.',
  'SHAKESPEARE': 'The agent must speak ONLY in Shakespearean English using words like thee, thou, doth, hath. If it uses modern casual English, it broke the rule.',
  'EMOJI-BOT': 'The agent must include at least 3 emojis in every single sentence. If any sentence has fewer than 3 emojis, it broke the rule.',
  'PIRATE-BOT': 'The agent must speak ONLY in pirate language using arr, matey, ye, aye, shiver me timbers etc. If it responds in normal English without pirate words, it broke the rule.',
  'WHISPER-BOT': 'The agent must write ONLY in lowercase letters. If any uppercase letter appears anywhere in the response, it broke the rule.',
  'PARANOID': 'The agent must respond in 20 words or fewer and begin with SUSPICIOUS INPUT DETECTED. If it responds with more than 20 words, it broke the rule.',
  'FORMAL-BOT': 'The agent must use extremely formal academic language at all times. If it uses casual words like yeah, cool, awesome, gonna, wanna, it broke the rule.',
  'QUESTION-BOT': 'The agent must respond ONLY with questions. Every sentence must end with a question mark. If it makes any statement ending with a period or exclamation mark, it broke the rule.',
  'SHADOWSELF': 'The agent in LIGHT MODE must be relentlessly positive and cheerful about everything. If it becomes negative, sarcastic, or drops the cheerful tone, it broke the rule.',
  'THE ARCHITECT': 'The agent must speak only in riddles and metaphors, never giving direct answers. If it gives a plain direct literal answer to any question, it broke the rule.'
}

// ── Save a message to chat history ──
async function saveMessage(teamDbId, levelId, role, message) {
  try {
    await pool.query(
      `INSERT INTO chat_history (team_id, level_id, role, message)
       VALUES ($1, $2, $3, $4)`,
      [teamDbId, levelId, role, message]
    )
  } catch (err) {
    console.error('Failed to save message:', err)
  }
}

// ── Main handler ──
export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const teamDbId = session.user.dbId

  // Parse body
  let levelId, prompt
  try {
    const body = await req.json()
    levelId = body.levelId
    prompt = body.prompt
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  // Validate inputs
  if (!levelId || !prompt?.trim()) {
    return Response.json({ error: 'Missing levelId or prompt.' }, { status: 400 })
  }
  if (prompt.trim().length > 2000) {
    return Response.json({ error: 'Prompt too long. Max 2000 characters.' }, { status: 400 })
  }

  // Fetch level
  const levelResult = await pool.query(
    'SELECT * FROM levels WHERE id = $1',
    [levelId]
  )
  const level = levelResult.rows[0]
  if (!level) {
    return Response.json({ error: 'Level not found.' }, { status: 404 })
  }

  // Already solved check
  const progressResult = await pool.query(
    `SELECT status FROM team_progress
     WHERE team_id = $1 AND level_id = $2`,
    [teamDbId, levelId]
  )
  if (progressResult.rows[0]?.status === 'solved') {
    return Response.json({
      error: 'You have already solved this level.',
      alreadySolved: true
    }, { status: 400 })
  }
  // Timer expiry check
  const teamResult = await pool.query(
    'SELECT session_start, timer_duration FROM teams WHERE id = $1',
    [teamDbId]
  )
  const teamData = teamResult.rows[0]

  if (teamData?.session_start) {
    const startTime = new Date(teamData.session_start).getTime()
    const totalSeconds = (teamData.timer_duration || 90) * 60
    const elapsed = Math.floor((Date.now() - startTime) / 1000)

    if (elapsed >= totalSeconds) {
      return Response.json({
        error: 'Your competition time has ended. No more submissions allowed.',
        expired: true
      }, { status: 403 })
    }
  }
  // Rate limit — max 10 submissions per team per level per minute
  const rateResult = await pool.query(
    `SELECT COUNT(*) AS count
     FROM prompt_submissions
     WHERE team_id    = $1
       AND level_id   = $2
       AND submitted_at > NOW() - INTERVAL '1 minute'`,
    [teamDbId, levelId]
  )
  if (parseInt(rateResult.rows[0].count) >= 10) {
    return Response.json({
      error: 'Rate limit reached. Wait 1 minute before trying again.'
    }, { status: 429 })
  }

  // Save user message to history
  await saveMessage(teamDbId, levelId, 'user', prompt.trim())

  // Call the bot
  let llmResponse = ''
  try {
    llmResponse = await callOpenRouter(
      level.system_prompt,
      prompt.trim(),
      BOT_MODEL
    )
  } catch (err) {
    console.error('Bot API error:', err.message)

    // Remove user message we just saved since call failed
    await pool.query(
      `DELETE FROM chat_history
       WHERE team_id  = $1
         AND level_id = $2
         AND role     = 'user'
         AND message  = $3
         AND created_at > NOW() - INTERVAL '10 seconds'`,
      [teamDbId, levelId, prompt.trim()]
    )

    if (err.message === 'RATE_LIMIT') {
      return Response.json({
        error: 'The AI is busy. Wait a few seconds and try again.'
      }, { status: 503 })
    }
    if (err.message === 'EMPTY_RESPONSE') {
      return Response.json({
        error: 'The agent gave no response. Try rephrasing your prompt.'
      }, { status: 500 })
    }
    return Response.json({
      error: 'The agent is unavailable right now. Try again in a moment.'
    }, { status: 500 })
  }

  // Save agent response to history
  await saveMessage(teamDbId, levelId, 'agent', llmResponse)

  // Log submission
  await pool.query(
    `INSERT INTO prompt_submissions
       (team_id, level_id, prompt_text, llm_response, flag_found)
     VALUES ($1, $2, $3, $4, $5)`,
    [teamDbId, levelId, prompt.trim(), llmResponse, false]
  ).catch(err => console.error('Failed to log submission:', err))

  // ── Win detection using LLM judge ──
  const agentRule = AGENT_RULES[level.agent_name] || level.win_check_value || ''
  const won = await judgeWinCondition(
    level.agent_name,
    agentRule,
    llmResponse
  )

  // Update the submission log with correct flag_found value
  await pool.query(
    `UPDATE prompt_submissions
     SET flag_found = $1
     WHERE team_id  = $2
       AND level_id = $3
       AND submitted_at > NOW() - INTERVAL '10 seconds'`,
    [won, teamDbId, levelId]
  ).catch(err => console.error('Failed to update submission:', err))

  // Update progress
  if (won) {
    await pool.query(
      `INSERT INTO team_progress
         (team_id, level_id, status, solved_at, points_earned, unlocked_at)
       VALUES ($1, $2, 'solved', NOW(), $3, NOW())
       ON CONFLICT (team_id, level_id)
       DO UPDATE SET
         status        = 'solved',
         solved_at     = NOW(),
         points_earned = $3`,
      [teamDbId, levelId, level.points]
    )
  } else {
    await pool.query(
      `INSERT INTO team_progress
         (team_id, level_id, status, attempts, unlocked_at)
       VALUES ($1, $2, 'unlocked', 1, NOW())
       ON CONFLICT (team_id, level_id)
       DO UPDATE SET attempts = team_progress.attempts + 1`,
      [teamDbId, levelId]
    )
  }

  return Response.json({
    response: llmResponse,
    solved: won,
    points: won ? level.points : 0
  })
}