import { withAuth } from 'next-auth/middleware'

export const proxy = withAuth({
  pages: {
    signIn: '/login'
  }
})

export const config = {
  matcher: [
    '/arena/:path*',
    '/api/submit/:path*',
    '/api/progress/:path*',
    '/api/level/:path*',
    '/api/chat/:path*',
    '/api/timer/:path*'
  ]
}