import * as http from 'http';
import {WebSocketServer} from 'ws';
import {route} from '../../http/base.js';
import {parseData, readReadableStream, readStreamToPromise} from '../../utils.js';
import jwt from 'jsonwebtoken';
import {getEventStore} from '../../ws/ws.js';
import {AuthModule} from '../../http/auth.js';
import {initSdk} from '../../http/sdk.js';


const wsServer = new WebSocketServer({noServer: true});

const hostname = 'localhost'
const port = process.env.PORT || 3001;

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
  const headers = new Headers();
  for (var key in req.headers) {
    if (req.headers[key]) headers.append(key, req.headers[key]);
  }
  const body = req.method === 'POST' ? await getBody(req) : null;
  // TODO remove hardcoded http
  const baseUrl = process.env.SERVER_URL
  console.log((new URL(req.url, baseUrl)).pathname)
  const reqObj = {
  ...req,
    body,
    headers,
  }
  let request = new Request(new URL(req.url, baseUrl), reqObj)
  return request
}
async function convertResponseToServerResponse(response, serverResponse) {
  const headers = {};
  for (const headerName of response.headers.keys()) {
    const header = response.headers.get(headerName);
    headers[headerName] = header
  }
  serverResponse.writeHead(response.status, headers)
  if(response.body) {
    const body = await readReadableStream(response.body)
    serverResponse.write(body)
  }
}

const server = http.createServer(async (req, res) => {
  const request = await convertIncomingMessageToRequest(req)
  const authResp = await AuthModule(request);
  if(authResp)  {
    await convertResponseToServerResponse(authResp, res);
    // Todo, remove this return and see if the user is auth or not
    return res.end()
  }

  if (req.method === 'POST') {
    const bodyString = await readStreamToPromise(req);
    const body = parseData(bodyString);
    const result = await route(req.url, body);
    if (result?.error) {
      res.statusCode = result.statusCode || 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(result.error));
    } else {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(result ?? null));
    }
  }
  res.end();
});

server.listen(port, hostname, async () => {
  await initSdk()
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
