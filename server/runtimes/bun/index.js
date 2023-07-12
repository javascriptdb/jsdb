import {route} from '../../http/base.js';
import {parseData, readStreamToPromise} from '../../utils.js';

const port = process.env.PORT || 3001;
const hostname = '0.0.0.0';

const server = Bun.serve({
  port,
  hostname,
  async fetch(req) {
    if(req.method === 'POST') {
      const bodyString = await readStreamToPromise(req.body);
      const body = parseData(bodyString)
      const result = await route(req.url, body);
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
    return new Response("Welcome to Bun!");
  },
});

console.log(`Listening on http://${hostname}:${port}/`);