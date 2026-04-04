const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Root route — serve the landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 fallback
app.use((req, res) => {
  res.status(404).send('<h1>404 — Page Not Found</h1><a href="/">Go Home</a>');
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
