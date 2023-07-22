import * as http from 'http';
import {WebSocketServer} from 'ws';
import {route} from '../../http/base.js';
import {parseData, readStreamToPromise} from '../../utils.js';
import jwt from 'jsonwebtoken';
import {getEventStore} from '../../ws/ws.js';
import {Auth} from '@auth/core';
import GitHub from '@auth/core/providers/github';

const wsServer = new WebSocketServer({noServer: true});

const hostname = 'localhost'
const port = process.env.PORT || 3001;

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
async function getBody(request) {
  return new Promise((resolve) => {
    const bodyParts = [];
    let body;
    request.on('data', (chunk) => {
      bodyParts.push(chunk);
    }).on('end', () => {
      body = Buffer.concat(bodyParts).toString();
      resolve(body)
    });
  });
}

async function convertIncomingMessageToRequest(req){
  var headers = new Headers();
  for (var key in req.headers) {
    if (req.headers[key]) headers.append(key, req.headers[key]);
  }
  const url = new URL(req.url, `http://${req.headers.host}`);
  const body = req.method === 'POST' ? await getBody(req) : null;
  let request = new Request(url, {
    method: req.method,
    body,
    headers,
  })
  return request
}


const server = http.createServer(async (req, res) => {
  try {
    // req.url is /auth/signin
    // Auth.js library expects http://localhost:3001/auth/signin

    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'OPTIONS, POST, GET',
      'Access-Control-Allow-Headers': '*',
    };
    if (req.method === 'OPTIONS') {
      res.writeHead(204, headers);
      res.end();
      return;
    }
    const request = await convertIncomingMessageToRequest(req)
    const auth = await Auth(request, optionsEnvVar);

    if(req.url.includes('/auth/signin/') && request.method === 'POST' && auth.status === 302 && auth.headers.get('location')) {
      headers.Location = auth.headers.get('location')
      res.writeHead(302, headers);
      console.log('here')
      // res.writeHead(200, headers);
      return res.end();
    } else {
      const text = await auth.text()
      headers['Content-Type'] = 'text/html'
      res.writeHead(200, headers);
      res.write(text)
      return res.end();
    }

  } catch (e) {
    console.log(e)
    return res.end();
  }
  // if (req.method === 'POST') {
  //   const bodyString = await readStreamToPromise(req);
  //   const body = parseData(bodyString);
  //   const result = await route(req.url, body);
  //   if (result?.error) {
  //     res.statusCode = result.statusCode || 500;
  //     res.setHeader('Content-Type', 'application/json');
  //     res.end(JSON.stringify(result.error));
  //   } else {
  //     res.statusCode = 200;
  //     res.setHeader('Content-Type', 'application/json');
  //     res.end(JSON.stringify(result ?? null));
  //   }
  // }
  // res.end();
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});

server.on('upgrade', (request, socket, head) => {
  wsServer.handleUpgrade(request, socket, head, socket => {
    wsServer.emit('connection', socket, request);
  });
});

wsServer.on('connection', socket => {
  socket.on('message', async message => {
    const parsedMessage = parseData(message);

    let token;
    const bearer = parsedMessage.authorization?.replace('Bearer ','').replace('undefined','');

    if(bearer) {
      token = jwt.verify(bearer, process.env.JWT_SECRET);
    }

    if(parsedMessage.subscription === true) {
      const unsubscribe = (await getEventStore(parsedMessage)).subscribe(result => {
        socket.send(JSON.stringify({
          value: result.value,
          eventName: parsedMessage.eventName,
          url: parsedMessage.url,
          collection: parsedMessage.collection,
        }))
      })
      // TODO : un subscribe from all stores if socket closes
    } else {
      // TODO : remove the parsedBody parameter, parse the body here too
      const result = await route(parsedMessage.url, parsedMessage);
      // TODO : what happens if the result contains a property called error? Should we let the internals crash and have a try catch here?
      if(result?.error) {
        socket.send(JSON.stringify({
          error: result.error,
          eventName: parsedMessage.eventName,
          url: parsedMessage.url,
        }))
      } else {
        socket.send(JSON.stringify({
          value: result,
          eventName: parsedMessage.eventName,
          url: parsedMessage.url,
          collection: parsedMessage.collection,
        }))
      }
    }
  });
});
