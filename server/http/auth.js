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
  headers.set('access-control-expose-headers', 'set-cookie')
  // merge both auth and added headers
  for (const headerName of auth.headers.keys()) {
    const header = auth.headers.get(headerName);
    headers.set(headerName, header)
  }
  for (const headerName of headers.keys()) {
    const header = headers.get(headerName);
    auth.headers.set(headerName, header)
  }
  // comes from sdk and all redirections needs to be triggered manually from the sdk
  if (auth.status === 302 && request.headers.get('origin') !== process.env.SERVER_URL) {
    return new Response(auth.headers.get('location'), {headers, status: 200});
  } else {
    return  auth
  }
}

