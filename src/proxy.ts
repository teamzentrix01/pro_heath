import { NextRequest, NextResponse } from 'next/server';

const parseOrigins = (value?: string) =>
  value
    ?.split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean) ?? [];

const configuredOrigins = [
  ...parseOrigins(process.env.FRONTEND_URL),
  ...parseOrigins(process.env.FRONTEND_URLS),
  ...parseOrigins(process.env.NEXT_PUBLIC_FRONTEND_URL),
  'https://pro-heath.vercel.app',
  'https://pro-health-track.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001',
];

const corsHeaders = (origin: string) => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  Vary: 'Origin',
});

export function proxy(request: NextRequest) {
  const origin = request.headers.get('origin')?.replace(/\/$/, '');
  const isAllowedOrigin = origin && configuredOrigins.includes(origin);

  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: isAllowedOrigin ? corsHeaders(origin) : undefined,
    });
  }

  const response = NextResponse.next();

  if (isAllowedOrigin) {
    Object.entries(corsHeaders(origin)).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  }

  return response;
}

export const config = {
  matcher: '/api/:path*',
};
