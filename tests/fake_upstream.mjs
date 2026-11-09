// Local stand-in for Kindwise used ONLY by tests. POST /__set {response} changes the canned reply.
import http from "node:http";
let resp = { status: 200, body: {} };
http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  if (req.url === "/__set") { resp = JSON.parse(Buffer.concat(chunks)); res.writeHead(200); return res.end("ok"); }
  res.writeHead(resp.status, { "content-type": "application/json" }); res.end(JSON.stringify(resp.body));
}).listen(Number(process.argv[2]), "127.0.0.1");
