import * as http from 'http';
import {WebSocketServer} from 'ws';
import {route} from '../../http/base.js';
import {readStreamToPromise} from '../../utils.js';

const wsServer = new WebSocketServer({noServer: true});

const hostname = '0.0.0.0';
const port = process.env.PORT || 3001;

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST') {
    const bodyString = await readStreamToPromise(req);
    const result = await route(req.url, bodyString);
    if (result.error) {
      res.statusCode = result.statusCode || 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(result.error));
    } else {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(result));
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