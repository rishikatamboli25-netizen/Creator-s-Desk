import http from 'http';

const PORT = process.env.PORT || 5004;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'Cart service is under construction.' }));
});



// CRITICAL FIX: Bound to 0.0.0.0 for Render internal routing
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🛒 Cart Service running on port ${PORT}`);
});



