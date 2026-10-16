const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || 'glitchnest-2026';
const DATA_FILE = path.join(__dirname, 'data', 'games.json');

// Middleware with 25mb payload support for local thumbnail uploads
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Helper to safely read games
function readGames() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return [];
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading games.json:', err);
    return [];
  }
}

// Helper to safely write games
function writeGames(games) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(games, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing games.json:', err);
    return false;
  }
}

// Admin Auth Middleware
function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.token;
  if (!token || token !== ADMIN_PASSCODE) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or missing admin passcode.'
    });
  }
  next();
}

/* =========================================================
   API Endpoints
   ========================================================= */

// Verify Admin Token
app.post('/api/admin/verify', (req, res) => {
  const { passcode } = req.body;
  if (passcode === ADMIN_PASSCODE) {
    return res.json({ success: true, token: ADMIN_PASSCODE });
  }
  return res.status(401).json({ success: false, message: 'Invalid passcode' });
});

// POST /api/upload/thumbnail — Protected endpoint to upload a local picture as 16:9 thumbnail
app.post('/api/upload/thumbnail', requireAdmin, (req, res) => {
  try {
    const { imageBase64, filename, slug } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'No image data received.' });
    }

    // Match data URI scheme e.g. data:image/png;base64,...
    const matches = imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: 'Invalid image format. Expected data URI base64 string.' });
    }

    const mimeType = matches[1].toLowerCase();
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    // Extension resolution
    let ext = 'png';
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = 'jpg';
    else if (mimeType.includes('webp')) ext = 'webp';
    else if (mimeType.includes('svg')) ext = 'svg';

    const cleanSlug = (slug || 'game-thumb').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-|-$/g, '') || 'thumb';
    const timestamp = Date.now();
    const finalFilename = `${cleanSlug}-${timestamp}.${ext}`;
    const uploadDir = path.join(__dirname, 'public', 'assets', 'thumbnails');

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, finalFilename);
    fs.writeFileSync(filePath, buffer);

    const publicUrl = `/assets/thumbnails/${finalFilename}`;
    console.log(`📸 Thumbnail uploaded: ${publicUrl} (${buffer.length} bytes)`);

    return res.json({
      success: true,
      url: publicUrl,
      filename: finalFilename,
      size: buffer.length
    });
  } catch (err) {
    console.error('Error handling thumbnail upload:', err);
    return res.status(500).json({ error: 'Failed to save uploaded thumbnail file.' });
  }
});

// GET /api/games — Fetch game catalog
app.get('/api/games', (req, res) => {
  const games = readGames();
  const includeHidden = req.query.all === 'true';

  if (includeHidden) {
    return res.json(games);
  }

  // Filter only visible games for public view
  const visibleGames = games.filter(g => g.visible !== false);
  res.json(visibleGames);
});

// GET /api/games/:id — Fetch single game details
app.get('/api/games/:id', (req, res) => {
  const { id } = req.params;
  const games = readGames();
  const game = games.find(g => g.id === id || g.slug === id);

  if (!game) {
    return res.status(404).json({ error: 'Game not found', id });
  }

  res.json(game);
});

// POST /api/games — Protected endpoint to add a new game entry
app.post('/api/games', requireAdmin, (req, res) => {
  const {
    id,
    slug,
    title,
    category,
    tags,
    description,
    synopsis,
    thumbnail,
    executable,
    version,
    developer,
    controls,
    instructions,
    highScoreGoal,
    featured,
    visible
  } = req.body;

  if (!title || !executable) {
    return res.status(400).json({ error: 'Title and executable path are required.' });
  }

  const games = readGames();
  const gameId = (slug || id || title.toLowerCase().replace(/[^a-z0-9]+/g, '-')).replace(/^-|-$/g, '');

  if (games.some(g => g.id === gameId)) {
    return res.status(409).json({ error: `Game with ID '${gameId}' already exists.` });
  }

  const parsedControls = Array.isArray(controls)
    ? controls
    : typeof controls === 'string'
      ? controls.split('\n').filter(Boolean).map(line => {
          const parts = line.split(':');
          return {
            key: parts[0]?.trim() || 'Key',
            action: parts[1]?.trim() || line.trim()
          };
        })
      : [];

  const parsedTags = Array.isArray(tags)
    ? tags
    : typeof tags === 'string'
      ? tags.split(',').map(t => t.trim()).filter(Boolean)
      : [category || 'Arcade'];

  const newGame = {
    id: gameId,
    slug: gameId,
    title: title.trim(),
    category: category || 'Arcade',
    tags: parsedTags,
    description: description || 'Exciting browser game on GlitchNest.',
    synopsis: synopsis || description || 'Play now in GlitchNest Arcade.',
    thumbnail: thumbnail || '/assets/thumbnails/default.svg',
    executable: executable.trim(),
    version: version || 'v1.0.0',
    developer: developer || 'Independent Creator',
    rating: '5.0',
    plays: '1',
    featured: Boolean(featured),
    visible: visible !== false,
    controls: parsedControls.length > 0 ? parsedControls : [
      { key: 'W A S D / Arrows', action: 'Movement' },
      { key: 'Space', action: 'Action' }
    ],
    instructions: instructions || 'Use controls to play and conquer the high score.',
    highScoreGoal: highScoreGoal || 'Aim for the GlitchNest leaderboard top spot!'
  };

  games.push(newGame);

  if (writeGames(games)) {
    return res.status(201).json({ success: true, game: newGame });
  } else {
    return res.status(500).json({ error: 'Failed to write to database.' });
  }
});

// PATCH /api/games/:id — Protected endpoint to toggle visibility or edit
app.patch('/api/games/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const games = readGames();
  const index = games.findIndex(g => g.id === id || g.slug === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Game not found' });
  }

  // Update provided fields
  games[index] = {
    ...games[index],
    ...req.body,
    id: games[index].id // keep immutable ID
  };

  if (writeGames(games)) {
    return res.json({ success: true, game: games[index] });
  } else {
    return res.status(500).json({ error: 'Failed to update database.' });
  }
});

// DELETE /api/games/:id — Protected endpoint to remove an entry
app.delete('/api/games/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const games = readGames();
  const filtered = games.filter(g => g.id !== id && g.slug !== id);

  if (filtered.length === games.length) {
    return res.status(404).json({ error: 'Game not found' });
  }

  if (writeGames(filtered)) {
    return res.json({ success: true, message: `Game '${id}' deleted successfully.` });
  } else {
    return res.status(500).json({ error: 'Failed to update database.' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`⚡ GlitchNest Server running on http://localhost:${PORT}`);
  console.log(`🔑 Admin Passcode configured: ${ADMIN_PASSCODE}`);
});
