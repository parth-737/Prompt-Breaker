import { getToken }     from 'next-auth/jwt'
import { NextResponse } from 'next/server'

// Changed from "export async function middleware" to "export default async function proxy"
export default async function proxy(req) {
  const token    = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const pathname = req.nextUrl.pathname

  // Routes anyone can access without logging in
  const publicRoutes = [
    '/login',
    '/leaderboard',
    '/api/auth'
  ]

  const isPublic = publicRoutes.some(route => pathname.startsWith(route))

  // If visiting root URL redirect to login
  if (pathname === '/') {
    if (token) {
      return NextResponse.redirect(new URL('/arena', req.url))
    }
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // If not logged in and trying to access protected route
  if (!isPublic && !token) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // If already logged in and visiting login page
  // redirect straight to arena
  if (pathname === '/login' && token) {
    return NextResponse.redirect(new URL('/arena', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/',
    '/login',
    '/arena/:path*',
    '/leaderboard',
    '/api/submit/:path*',
    '/api/progress/:path*',
    '/api/level/:path*',
    '/api/chat/:path*',
    '/api/timer/:path*'
  ]
}