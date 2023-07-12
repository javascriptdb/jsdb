import * as http from 'http';
import {WebSocketServer} from 'ws';
import {route} from '../../http/base.js';
import {parseData, readStreamToPromise} from '../../utils.js';
import jwt from 'jsonwebtoken';

const wsServer = new WebSocketServer({noServer: true});

const hostname = '0.0.0.0';
const port = process.env.PORT || 3001;

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST') {
    const bodyString = await readStreamToPromise(req);
    const result = await route(req.url, bodyString);
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
      // const result = await route(`/db/${}`, bodyString);
    } else {
      const result = await route(parsedMessage.url, undefined, parsedMessage);
      if(result?.error) {

      } else {
        socket.send(JSON.stringify({
          value: result,
          eventName: parsedMessage.eventName,
          url: parsedMessage.url,
          collection: parsedMessage.collection,
        }))
      }
    }


    // const result = await route(parsedMessage.url, parsedMessage.body);
    // socket.send(JSON.stringify(result));
  });
});