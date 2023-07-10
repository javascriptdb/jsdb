const port = process.env.PORT || 3001;
const hostname = '0.0.0.0';

const server = Bun.serve({
  port,
  hostname,
  fetch(req) {
    if(req.method === 'POST') {
      const body = [];
      // req.body.
    }
    return new Response("Welcome to Bun!");
  },
});

console.log(`Listening on http://${hostname}:${port}/`);