const path = require('path');
const express = require('express');
const app = require('./api/index');

const PORT = process.env.PORT || 8085;

// Serve public static frontend
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

// Fallback all non-API GET requests to index.html (SPA routing)
app.get('*', (req, res, next) => {
  if (req.originalUrl.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log('========================================================');
  console.log(`🚀 HackHub Server running on http://localhost:${PORT}`);
  console.log(`📡 API Health Check: http://localhost:${PORT}/api/health`);
  console.log('🌐 Frontend UI ready at root URL');
  console.log('========================================================');
});
