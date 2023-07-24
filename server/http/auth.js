import {Auth} from '@auth/core';
import GitHub from '@auth/core/providers/github';

const optionsEnvVar = {
  // Configure one or more authentication providers
  providers: [
    GitHub({
      clientId: '8a9219d06d63a95bf1af',
      clientSecret: '746ce3dd62cfbd400289e7647063ecc907ffab17',
    }),
  ],
  trustHost: true,
  secret: '280be61e650f6ca8476717130dc5c15ef5c75a1bf20764c991c6ad06dfea1687'
}
// Request https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API needed by Auth.js
export async function AuthModule(request) {
  let headers = new Headers();
  const url = new URL(request.url)
  if (url.pathname.split('/')[1] === 'auth') {
    // req.url is /auth/signin
    // Auth.js library expects http://localhost:3001/auth/signin
    headers.set('Access-Control-Allow-Methods', 'OPTIONS, POST, GET')
    headers.set('Access-Control-Allow-Headers', '*')
    headers.set('Access-Control-Allow-Credentials', true)
    if (request.headers.get('origin')) {
      headers.set('Access-Control-Allow-Origin', request.headers.get('origin'))
    }
    if (request.method === 'OPTIONS') {
      return new Response(null, {headers, status: 204});
    }
  }
  const auth = await Auth(request, optionsEnvVar);
  for (const headerName of auth.headers.keys()) {
    const header = auth.headers.get(headerName);
    headers.set(headerName, header)
  }
  if (url.pathname === '/auth/csrf' && request.headers.get('origin')) {
    const body = await auth.json();
    headers.set('access-control-expose-headers', 'set-cookie')
    return new Response(JSON.stringify(body), {headers, status: 302});
  } else if (
    url.pathname.includes('/auth/signin') &&
    request.method === 'POST' &&
    auth.status === 302 &&
    auth.headers.get('location')) {
    if (request.headers.get('origin') === process.env.SERVER_URL) {
      return new Response(null, {headers, status: 302});
    } else {
      return new Response(auth.headers.get('location'), {headers, status: 200});
    }
  } else {
    const text = await auth.text()
    headers.set('Content-Type', 'text/html')
    return new Response(text, {headers, status: 200});
  }
}

