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
  secret: '280be61e650f6ca8476717130dc5c15ef5c75a1bf20764c991c6ad06dfea1687',
  cookies: {
    csrfToken: {
      name: 'next-auth.csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'none',
        path: '/',
        secure: true
      }
    },
    pkceCodeVerifier: {
      name: 'next-auth.pkce.code_verifier',
      options: {
        httpOnly: true,
        sameSite: 'none',
        path: '/',
        secure: true
      }
    }
  },
  callbacks: {
    async signIn(args) {
    // async signIn({user, account, profile, email, credentials}) {
      console.log(`signIn callback: ${JSON.stringify(args)}`)
      return true
    },
    // async redirect({ url, baseUrl }) {
    async redirect(args) {
      console.log(`redirect callback: ${JSON.stringify(args)}`)
      return null
      //return baseUrl
    },
    // async session({session, user, token}) {
    async session(args) {
      console.log(`session callback: ${JSON.stringify(args)}`)
      return args.session
    },
    // async jwt({token, user, account, profile, isNewUser}) {
    async jwt(args) {
      console.log(`jwt callback: ${JSON.stringify(args)}`)
      return args.token
    }
  }
}
// Request https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API needed by Auth.js
export async function AuthModule(request) {
  let headers = new Headers();
  const url = new URL(request.url)
  if (['auth', 'db', 'functions'].includes(url.pathname.split('/')[1])) {
    headers.set('Access-Control-Allow-Methods', 'OPTIONS, POST, GET')
    headers.set('Access-Control-Allow-Headers', '*')
    headers.set('Access-Control-Allow-Credentials', true)
    if (request.headers.get('origin')) {
      headers.set('Access-Control-Allow-Origin', request.headers.get('origin'))
    }
    if (request.method === 'OPTIONS') {
      return new Response(null, {headers, status: 204});
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
    if(url.pathname.includes('auth/callback') ) {
      headers.set('Content-type', 'text/html')
      return new Response(`<script>window.close();</script>`, {headers, status: 200});
    }

    // comes from sdk and all redirections needs to be triggered manually from the sdk
    const origin = request.headers.get('origin')
    if (auth.status === 302 && origin && origin !== process.env.SERVER_URL) {
      return new Response(auth.headers.get('location'), {headers, status: 200});
    } else {
      return  auth
    }
  }
  return null
}

