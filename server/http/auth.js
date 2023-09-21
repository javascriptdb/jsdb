import {Auth} from '@auth/core';
import GitHub from '@auth/core/providers/github';
import {readReadableStream} from '../utils.js';
import {decode} from '@auth/core/jwt';
import {sdkDb} from './sdk.js';

const optionsEnvVar = {
  // Configure one or more authentication providers
  providers: [
    GitHub({
      clientId: '8a9219d06d63a95bf1af',
      clientSecret: '746ce3dd62cfbd400289e7647063ecc907ffab17',
    }),
  ],
  trustHost: true,
  secret: process.env.JWT_SECRET,
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
     // console.log(`signIn callback`)
      return true
    },
    // async redirect({ url, baseUrl }) {
    async redirect(args) {
      //console.log(`redirect callback: ${JSON.stringify(args)}`)
      return null
      //return baseUrl
    },
    // async session({session, user, token}) {
    async session(args) {
      //console.log(`session callback: ${JSON.stringify(args)}`)
      return args.session
    },
    // async jwt({token, user, account, profile, isNewUser}) {
    async jwt(args) {
     console.log(`jwt callback: ${JSON.stringify(args)}`)
      return args.token;
    }
  },
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
    if(url.pathname.includes('auth/signin/')) {
      const body = await readReadableStream(request.clone().body)
      const searchParams = new URLSearchParams(body);
      if(searchParams?.get('customProviderSignin') === 'true') {
        const pathname = (new URL(request.url)).pathname
        const clone = new Request(new URL(pathname, process.env.SERVER_URL) , request)
        request = clone
        console.log('here')
      }
    }
    const auth = await Auth(request, optionsEnvVar);
    headers.set('access-control-expose-headers', 'set-cookie')
    // merge both auth and added headers
    for (const headerName of auth.headers.keys()) {
      const header = auth.headers.get(headerName);
      headers.set(headerName, header)
      if (headerName === 'set-cookie') {
        console.log(header)
      }
    }
    for (const headerName of headers.keys()) {
      const header = headers.get(headerName);
      auth.headers.set(headerName, header)
    }
    if(url.pathname.includes('auth/callback') ) {
      headers.set('Content-type', 'text/html')
      const codedSessionToken = headers.get('set-cookie')
        ?.split(';')
        ?.map(dirtyCookie => dirtyCookie.split(','))
        ?.flat()
        ?.filter(keyValue => keyValue.includes('next-auth.session-token'))?.[0]
        ?.split('=')?.[1];
      const decodedSessionToken = await decode({
        token: codedSessionToken,
        secret: process.env.JWT_SECRET,
      })

      const resp = `
<script>console.log(window, parent); window.opener.postMessage('${JSON.stringify({
        token: codedSessionToken
      })}', '*');</script>
`
      return new Response(resp, {headers, status: 200});
    }
    // comes from sdk and all redirections needs to be triggered manually from the sdk
    let origin = request.headers.get('origin')
    if(origin) origin = new URL(origin);
    if (auth.status === 302 && origin && origin.href !== process.env.SERVER_URL) {
      // custom provider signin
      return new Response(auth.headers.get('location'), {headers, status: 200});
    } else {
      return  auth
    }
  }
  return null
}

