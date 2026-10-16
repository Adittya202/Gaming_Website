const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || 'glitchnest-2026';
const DATA_FILE = path.join(__dirname, 'data', 'games.json');

// GitHub Sync Configuration (enables persistent game records and thumbnail uploads on Vercel)
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'Adittya202';
const GITHUB_REPO = process.env.GITHUB_REPO || 'Gaming_Website';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

// In-memory catalog cache to ensure instant reactivity across requests
let inMemoryGames = null;

// Middleware with 25mb payload support for local thumbnail uploads
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Helper to safely extract GitHub Token from request header or environment
function getGitHubToken(req) {
  const headerToken = req?.headers ? req.headers['x-github-token'] : null;
  if (headerToken && typeof headerToken === 'string' && headerToken.trim()) {
    return headerToken.trim();
  }
  return process.env.GITHUB_TOKEN || process.env.GH_TOKEN || null;
}

// Helper to safely read games catalog (in-memory cached + local fallback)
function readGames() {
  if (inMemoryGames !== null) {
    return inMemoryGames;
  }
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      inMemoryGames = JSON.parse(raw);
      return inMemoryGames;
    }
  } catch (err) {
    console.error('Error reading games.json:', err.message);
  }
  inMemoryGames = [];
  return inMemoryGames;
}

/**
 * Commits a file directly to the GitHub repository via GitHub REST API v3.
 * Used for persistent storage on serverless hosts like Vercel where the filesystem is read-only.
 */
async function syncFileToGitHub(filePath, fileContentOrBuffer, commitMessage, token) {
  if (!token) {
    throw new Error('No GitHub Personal Access Token provided.');
  }

  const cleanPath = filePath.replace(/^\/+/, '');
  const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${cleanPath}`;
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'Authorization': `Bearer ${token}`,
    'User-Agent': 'GlitchNest-Vercel-Portal',
    'Content-Type': 'application/json'
  };

  // 1. Fetch current file SHA if it already exists on the target branch
  let sha = undefined;
  try {
    const getRes = await fetch(`${apiUrl}?ref=${encodeURIComponent(GITHUB_BRANCH)}`, { headers });
    if (getRes.ok) {
      const existingData = await getRes.json();
      sha = existingData.sha;
    }
  } catch (err) {
    // Non-fatal: new files do not have an existing SHA
  }

  // 2. Format content as base64
  let base64Content;
  if (Buffer.isBuffer(fileContentOrBuffer)) {
    base64Content = fileContentOrBuffer.toString('base64');
  } else if (typeof fileContentOrBuffer === 'string') {
    base64Content = Buffer.from(fileContentOrBuffer, 'utf8').toString('base64');
  } else {
    base64Content = Buffer.from(JSON.stringify(fileContentOrBuffer, null, 2), 'utf8').toString('base64');
  }

  // 3. Commit file via PUT request
  const payload = {
    message: commitMessage || `chore: update ${cleanPath}`,
    content: base64Content,
    branch: GITHUB_BRANCH
  };
  if (sha) {
    payload.sha = sha;
  }

  const putRes = await fetch(apiUrl, {
    method: 'PUT',
    headers,
    body: JSON.stringify(payload)
  });

  const putData = await putRes.json();
  if (!putRes.ok) {
    const msg = putData.message || putRes.statusText || 'GitHub API error';
    throw new Error(`GitHub API error (${putRes.status}): ${msg}`);
  }

  const rawUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${cleanPath}`;
  return {
    success: true,
    sha: putData.content?.sha,
    commitUrl: putData.commit?.html_url || '',
    rawUrl
  };
}

/**
 * Persists the updated games catalog:
 * - Updates in-memory cache instantly
 * - Attempts local filesystem write (for local PC development)
 * - Commits to GitHub repository (for Vercel serverless persistence)
 */
async function persistGames(games, commitMessage, gitHubToken) {
  // Update in-memory state immediately
  inMemoryGames = games;

  let localSuccess = false;
  let localError = null;

  try {
    const dataDir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(games, null, 2), 'utf8');
    localSuccess = true;
  } catch (err) {
    localError = err;
    // On Vercel / serverless this throws EROFS (Read-only file system)
  }

  // If local write succeeded and no GitHub token is configured, local dev mode succeeds
  if (localSuccess && !gitHubToken && !process.env.VERCEL) {
    return { success: true, local: true, syncedToGitHub: false };
  }

  // If GitHub token is present, commit changes to GitHub repository
  if (gitHubToken) {
    try {
      const ghResult = await syncFileToGitHub(
        'data/games.json',
        JSON.stringify(games, null, 2),
        commitMessage || 'chore(catalog): update games.json',
        gitHubToken
      );
      return {
        success: true,
        local: localSuccess,
        syncedToGitHub: true,
        commitUrl: ghResult.commitUrl
      };
    } catch (ghErr) {
      console.error('Failed to sync games.json to GitHub:', ghErr);
      if (localSuccess) {
        return {
          success: true,
          local: true,
          syncedToGitHub: false,
          warning: `Saved locally, but GitHub sync failed: ${ghErr.message}`
        };
      }
      throw new Error(`GitHub sync failed: ${ghErr.message}`);
    }
  }

  // If local write failed (e.g. Vercel read-only filesystem) and no GitHub token was provided
  if (!localSuccess) {
    throw new Error(
      'Vercel filesystem is read-only. Please connect your GitHub Personal Access Token in the Admin Portal (GitHub Sync section) or set GITHUB_TOKEN in your Vercel Environment Variables so changes can be committed to your GitHub repository.'
    );
  }

  return { success: true, local: true, syncedToGitHub: false };
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
   API Endpoints & Verification
   ========================================================= */

// Domain Ownership Verification
app.get(['/79d74165874b669fdcb9.txt', '/79d74165874b669fdcb9'], (req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.send('70e7d3ac2dda38b34c03');
});

// Verify Admin Token
app.post('/api/admin/verify', (req, res) => {
  const { passcode } = req.body;
  if (passcode === ADMIN_PASSCODE) {
    return res.json({ success: true, token: ADMIN_PASSCODE });
  }
  return res.status(401).json({ success: false, message: 'Invalid passcode' });
});

// GET /api/admin/status — Check server environment and GitHub sync setup
app.get('/api/admin/status', (req, res) => {
  const hasEnvToken = Boolean(process.env.GITHUB_TOKEN || process.env.GH_TOKEN);
  const isVercel = Boolean(process.env.VERCEL);
  res.json({
    isVercel,
    hasEnvToken,
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    branch: GITHUB_BRANCH,
    gamesCount: readGames().length
  });
});

// POST /api/admin/test-github — Test and validate a GitHub Personal Access Token
app.post('/api/admin/test-github', requireAdmin, async (req, res) => {
  const token = getGitHubToken(req);
  if (!token) {
    return res.status(400).json({
      success: false,
      error: 'No GitHub token provided. Please enter a Personal Access Token.'
    });
  }

  try {
    const testRes = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'GlitchNest-Vercel-Portal'
      }
    });

    const data = await testRes.json();
    if (!testRes.ok) {
      return res.status(testRes.status).json({
        success: false,
        error: `GitHub error (${testRes.status}): ${data.message || 'Access denied'}`
      });
    }

    const canPush = Boolean(data.permissions?.push || data.permissions?.admin);
    return res.json({
      success: true,
      repo: data.full_name,
      defaultBranch: data.default_branch,
      permissions: data.permissions,
      canPush,
      message: canPush
        ? `Successfully connected with write access to ${data.full_name}!`
        : `Connected to ${data.full_name}, but token might lack push/write permission.`
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: `Connection failure: ${err.message}`
    });
  }
});

// POST /api/upload/thumbnail — Protected endpoint to upload a local picture as 16:9 thumbnail
app.post('/api/upload/thumbnail', requireAdmin, async (req, res) => {
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
    const relativeRepoPath = `public/assets/thumbnails/${finalFilename}`;
    const localUploadDir = path.join(__dirname, 'public', 'assets', 'thumbnails');
    const localFilePath = path.join(localUploadDir, finalFilename);

    let localSaved = false;
    try {
      if (!fs.existsSync(localUploadDir)) {
        fs.mkdirSync(localUploadDir, { recursive: true });
      }
      fs.writeFileSync(localFilePath, buffer);
      localSaved = true;
      console.log(`📸 Thumbnail saved locally: ${localFilePath} (${buffer.length} bytes)`);
    } catch (fsErr) {
      // Expected on Vercel / serverless: EROFS read-only file system
    }

    const ghToken = getGitHubToken(req);

    // If local write succeeded and no GitHub token and not running on Vercel, return local public URL
    if (localSaved && !ghToken && !process.env.VERCEL) {
      const publicUrl = `/assets/thumbnails/${finalFilename}`;
      return res.json({
        success: true,
        url: publicUrl,
        filename: finalFilename,
        size: buffer.length
      });
    }

    // If GitHub token is provided, sync to GitHub repository
    if (ghToken) {
      try {
        const ghResult = await syncFileToGitHub(
          relativeRepoPath,
          buffer,
          `feat(assets): upload thumbnail ${finalFilename}`,
          ghToken
        );
        // Use raw GitHub URL so the picture displays immediately before Vercel finishes redeploying
        const immediateUrl = ghResult.rawUrl;
        return res.json({
          success: true,
          url: immediateUrl,
          relativeUrl: `/assets/thumbnails/${finalFilename}`,
          filename: finalFilename,
          size: buffer.length,
          syncedToGitHub: true,
          commitUrl: ghResult.commitUrl
        });
      } catch (ghErr) {
        console.error('GitHub thumbnail sync error:', ghErr);
        if (localSaved) {
          return res.json({
            success: true,
            url: `/assets/thumbnails/${finalFilename}`,
            filename: finalFilename,
            size: buffer.length,
            warning: `Saved locally, but GitHub sync failed: ${ghErr.message}`
          });
        }
        return res.status(500).json({
          error: `GitHub sync failed: ${ghErr.message}`
        });
      }
    }

    // If local write failed (e.g. Vercel) and no GitHub token provided
    return res.status(500).json({
      error: 'Vercel filesystem is read-only. Please connect your GitHub Token in Admin Settings or set GITHUB_TOKEN in your Vercel Environment Variables so thumbnails can be saved to your GitHub repository.'
    });
  } catch (err) {
    console.error('Error handling thumbnail upload:', err);
    return res.status(500).json({ error: 'Failed to process thumbnail file.' });
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
app.post('/api/games', requireAdmin, async (req, res) => {
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

  const ghToken = getGitHubToken(req);
  try {
    const result = await persistGames(
      games,
      `feat(catalog): register new game '${newGame.title}' (${gameId})`,
      ghToken
    );
    return res.status(201).json({
      success: true,
      game: newGame,
      syncedToGitHub: result.syncedToGitHub,
      commitUrl: result.commitUrl
    });
  } catch (err) {
    console.error('Add game error:', err);
    return res.status(500).json({ error: err.message || 'Failed to write to database.' });
  }
});

// PATCH /api/games/:id — Protected endpoint to toggle visibility or edit
app.patch('/api/games/:id', requireAdmin, async (req, res) => {
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

  const ghToken = getGitHubToken(req);
  try {
    const result = await persistGames(
      games,
      `chore(catalog): update game '${games[index].title}' (${games[index].id})`,
      ghToken
    );
    return res.json({
      success: true,
      game: games[index],
      syncedToGitHub: result.syncedToGitHub,
      commitUrl: result.commitUrl
    });
  } catch (err) {
    console.error('Patch game error:', err);
    return res.status(500).json({ error: err.message || 'Failed to update database.' });
  }
});

// DELETE /api/games/:id — Protected endpoint to remove an entry
app.delete('/api/games/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const games = readGames();
    const targetGame = games.find(g => g.id === id || g.slug === id);

    if (!targetGame) {
      return res.status(404).json({ error: `Game with ID '${id}' not found.` });
    }

    const filtered = games.filter(g => g.id !== id && g.slug !== id);
    const ghToken = getGitHubToken(req);

    const result = await persistGames(
      filtered,
      `chore(catalog): remove game '${targetGame.title}' (${id})`,
      ghToken
    );

    return res.json({
      success: true,
      message: `Game '${targetGame.title}' removed successfully.`,
      syncedToGitHub: result.syncedToGitHub,
      commitUrl: result.commitUrl
    });
  } catch (err) {
    console.error('Delete game error:', err);
    return res.status(500).json({ error: err.message || 'Failed to delete from database.' });
  }
});

// Export app for Vercel Serverless Function handler
module.exports = app;

// Start Server standalone
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`⚡ GlitchNest Server running on http://localhost:${PORT}`);
    console.log(`🔑 Admin Passcode configured: ${ADMIN_PASSCODE}`);
    console.log(`☁ GitHub Sync configured for: ${GITHUB_OWNER}/${GITHUB_REPO} (${GITHUB_BRANCH})`);
  });
}
