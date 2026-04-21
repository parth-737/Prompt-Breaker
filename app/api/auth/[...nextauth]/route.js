import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import pool   from '@/lib/db'

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        teamId:   { label: 'Team ID',  type: 'text'     },
        password: { label: 'Password', type: 'password'  }
      },
      async authorize(credentials) {
        if (!credentials?.teamId || !credentials?.password) return null

        const result = await pool.query(
          'SELECT * FROM teams WHERE team_id = $1',
          [credentials.teamId]
        )
        const team = result.rows[0]
        if (!team) return null

        const isValid = await bcrypt.compare(
          credentials.password,
          team.password_hash
        )
        if (!isValid) return null

        // Record session start time if this is first login
        if (!team.session_start) {
          await pool.query(
            `UPDATE teams
             SET session_start = NOW()
             WHERE id = $1`,
            [team.id]
          )
        }

        return {
          id:             team.id,
          teamId:         team.team_id,
          name:           team.team_name,
          college:        team.college,
          sessionStart:   team.session_start || new Date().toISOString(),
          timerDuration:  team.timer_duration || 90
        }
      }
    })
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.teamId        = user.teamId
        token.college       = user.college
        token.dbId          = user.id
        token.sessionStart  = user.sessionStart
        token.timerDuration = user.timerDuration
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.teamId        = token.teamId
        session.user.college       = token.college
        session.user.dbId          = token.dbId
        session.user.sessionStart  = token.sessionStart
        session.user.timerDuration = token.timerDuration
      }
      return session
    }
  },

  pages:   { signIn: '/login' },
  session: { strategy: 'jwt' }
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }