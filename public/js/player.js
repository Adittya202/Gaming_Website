/**
 * GlitchNest Portal - Game Details & Direct Launch Engine (player.js)
 * Loads game details, 16:9 artwork poster, instructions, AdSense hooks,
 * and sets up direct navigation to the game's executable link upon clicking Play.
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const gamePosterImg = document.getElementById('gamePosterImg');
  const directPlayBtn = document.getElementById('directPlayBtn');
  const directPlayBtnSecondary = document.getElementById('directPlayBtnSecondary');
  const targetLinkDisplay = document.getElementById('targetLinkDisplay');
  const sidebarDevCredit = document.getElementById('sidebarDevCredit');
  const shareBtn = document.getElementById('shareBtn');
  const favoriteBtn = document.getElementById('favoriteBtn');
  
  // Metadata fields
  const gameTitleEl = document.getElementById('gameTitle');
  const gameSynopsisEl = document.getElementById('gameSynopsis');
  const gameVersionBadge = document.getElementById('gameVersionBadge');
  const gameCategoryBadge = document.getElementById('gameCategoryBadge');
  const gameDevCredit = document.getElementById('gameDevCredit');
  const gameRatingEl = document.getElementById('gameRating');
  const gamePlaysEl = document.getElementById('gamePlays');
  const controlsGridEl = document.getElementById('controlsGrid');
  const gameInstructionsEl = document.getElementById('gameInstructions');
  const goalBannerEl = document.getElementById('goalBanner');
  const recommendedGridEl = document.getElementById('recommendedGrid');
  const showcaseContainer = document.getElementById('showcaseContainer');

  // Extract ID from URL (?id=...)
  const urlParams = new URLSearchParams(window.location.search);
  const gameId = urlParams.get('id');

  let currentGame = null;

  if (!gameId) {
    showErrorState('NO GAME SELECTED', 'Please choose a game from the GlitchNest catalog.');
    return;
  }

  /**
   * Robust Executable Link Resolver
   * Handles absolute URLs, relative game paths, domain URLs without protocol, etc.
   */
  function resolveExecutableUrl(raw) {
    if (!raw) return '';
    let url = String(raw).trim();
    if (!url) return '';

    // If starts with protocol like http://, https://, file://, etc.
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//i.test(url)) {
      return url;
    }

    // If relative path like /games/... or ./... or ../...
    if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) {
      return url;
    }

    // If starts with 'games/'
    if (url.startsWith('games/')) {
      return '/' + url;
    }

    // If domain-like format (e.g., buccpromotiongame.vercel.app, itch.io, poki.com)
    if (/^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}/.test(url)) {
      return 'https://' + url;
    }

    return url;
  }

  // Load Game Details from REST API
  async function loadGame() {
    try {
      const res = await fetch(`/api/games/${encodeURIComponent(gameId)}`);
      if (!res.ok) {
        throw new Error(`Game '${gameId}' not found in registry.`);
      }

      currentGame = await res.json();
      renderGameDetails(currentGame);
      loadRecommendations(currentGame.id);
      checkFavoriteStatus(currentGame.id);
    } catch (err) {
      console.error(err);
      showErrorState('GAME NOT FOUND', `Could not find an active game registry with ID: "${gameId}".`);
    }
  }

  // Populate Details into DOM & Configure Direct Play Link
  function renderGameDetails(game) {
    document.title = `${game.title} - GlitchNest Arcade`;

    if (gamePosterImg) {
      gamePosterImg.src = game.thumbnail || '/assets/thumbnails/default.svg';
      gamePosterImg.alt = `${game.title} Thumbnail Artwork`;
    }

    if (gameTitleEl) gameTitleEl.textContent = game.title;
    if (gameSynopsisEl) gameSynopsisEl.textContent = game.synopsis || game.description || 'Enjoy this game directly on GlitchNest.';
    if (gameVersionBadge) gameVersionBadge.textContent = game.version || 'v1.0';
    if (gameCategoryBadge) gameCategoryBadge.textContent = game.category || 'Arcade';
    if (gameDevCredit) gameDevCredit.textContent = game.developer || 'GlitchNest Studios';
    if (sidebarDevCredit) sidebarDevCredit.textContent = game.developer || 'GlitchNest';
    if (gameRatingEl) gameRatingEl.textContent = `★ ${game.rating || '5.0'} RATING`;
    if (gamePlaysEl) gamePlaysEl.textContent = `${game.plays || '10K'} PLAYS`;

    // Resolve the direct executable target link
    const targetUrl = resolveExecutableUrl(game.executable);

    if (targetLinkDisplay) {
      targetLinkDisplay.textContent = targetUrl || 'No link configured';
    }

    // HilltopAds DirectLink URL (Zone #7524905)
    const SPONSOR_DIRECT_URL = 'https://elementarywhole.com/b.3tVe0_PW3bpLv/bOm_VZJJZuDR0o3mN/TsIr0BOYTuA/1hLcTScj1/MfjZQ/5TMsDJkM';

    // Configure Direct Play buttons (both primary showcase & bottom of guide)
    const setupPlayButton = (btn) => {
      if (!btn) return;
      btn.href = targetUrl || '#';
      btn.setAttribute('title', `Launch ${game.title} directly`);
      btn.onclick = (e) => {
        if (!targetUrl || targetUrl === '#') {
          e.preventDefault();
          showToast('No executable link configured for this game.');
          return false;
        }
        // Open sponsored DirectLink in new tab to monetize game launch
        try {
          window.open(SPONSOR_DIRECT_URL, '_blank', 'noopener,noreferrer');
        } catch (err) {
          // Non-blocking
        }
        // Direct browser navigation straight to the executable link
        window.location.href = targetUrl;
        return false;
      };
    };

    setupPlayButton(directPlayBtn);
    setupPlayButton(directPlayBtnSecondary);

    // Visual Keyboard / Mouse Controls Guide
    if (controlsGridEl) {
      const controls = Array.isArray(game.controls) ? game.controls : [];
      if (controls.length > 0) {
        controlsGridEl.innerHTML = controls.map(ctrl => `
          <div class="control-item">
            <span class="control-action">${escapeHtml(ctrl.action)}</span>
            <kbd class="cyber-key">${escapeHtml(ctrl.key)}</kbd>
          </div>
        `).join('');
      } else {
        controlsGridEl.innerHTML = `
          <div class="control-item">
            <span class="control-action">Standard Input</span>
            <kbd class="cyber-key">Mouse / Keyboard</kbd>
          </div>
        `;
      }
    }

    // Instructions and High-score Goal
    if (gameInstructionsEl) {
      gameInstructionsEl.textContent = game.instructions || game.description || 'Follow on-screen objectives to play and score.';
    }

    if (goalBannerEl) {
      goalBannerEl.innerHTML = `<strong>HIGH-SCORE OBJECTIVE:</strong> ${escapeHtml(game.highScoreGoal || 'Aim for the top tier on the sunny leaderboards!')}`;
    }
  }

  // Share Game Link Action
  if (shareBtn) {
    shareBtn.addEventListener('click', () => {
      const url = window.location.href;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => {
          showToast('Game details link copied to clipboard!');
        }).catch(() => {
          prompt('Copy game link:', url);
        });
      } else {
        prompt('Copy game link:', url);
      }
    });
  }

  // Favorite / Like Toggle
  if (favoriteBtn) {
    favoriteBtn.addEventListener('click', () => {
      if (!currentGame) return;
      const favs = getFavorites();
      const index = favs.indexOf(currentGame.id);
      
      if (index === -1) {
        favs.push(currentGame.id);
        saveFavorites(favs);
        favoriteBtn.classList.add('liked');
        favoriteBtn.innerHTML = `♥ Liked`;
        showToast(`Added "${currentGame.title}" to Favorites!`);
      } else {
        favs.splice(index, 1);
        saveFavorites(favs);
        favoriteBtn.classList.remove('liked');
        favoriteBtn.innerHTML = `♡ Like`;
        showToast(`Removed from Favorites.`);
      }
    });
  }

  function getFavorites() {
    try {
      return JSON.parse(localStorage.getItem('glitchnest_favorites') || '[]');
    } catch (e) {
      return [];
    }
  }

  function saveFavorites(arr) {
    try {
      localStorage.setItem('glitchnest_favorites', JSON.stringify(arr));
    } catch (e) {}
  }

  function checkFavoriteStatus(id) {
    const favs = getFavorites();
    if (favoriteBtn) {
      if (favs.includes(id)) {
        favoriteBtn.classList.add('liked');
        favoriteBtn.innerHTML = `♥ Liked`;
      } else {
        favoriteBtn.classList.remove('liked');
        favoriteBtn.innerHTML = `♡ Like`;
      }
    }
  }

  // "More From GlitchNest" 4 Recommendations
  async function loadRecommendations(excludeId) {
    if (!recommendedGridEl) return;
    try {
      const res = await fetch('/api/games');
      const all = await res.json();
      const recommendations = all.filter(g => g.id !== excludeId && g.slug !== excludeId).slice(0, 4);

      if (recommendations.length === 0) {
        recommendedGridEl.innerHTML = `<p style="color: var(--ink-dim); font-family: var(--font-hand); font-size: 1.1rem;">No other games currently in catalog.</p>`;
        return;
      }

      recommendedGridEl.innerHTML = recommendations.map(game => `
        <a href="play.html?id=${encodeURIComponent(game.slug || game.id)}" class="game-card">
          <div class="card-thumbnail-container">
            <img src="${game.thumbnail || '/assets/thumbnails/default.svg'}" 
                 alt="${escapeHtml(game.title)}" 
                 class="card-thumbnail" 
                 loading="lazy">
            <span class="card-category-badge">${escapeHtml(game.category || 'Arcade')}</span>
            <div class="card-play-overlay">
              <div class="play-icon-circle">
                <div class="play-triangle"></div>
              </div>
            </div>
          </div>
          <div class="card-info">
            <h3 class="card-title">${escapeHtml(game.title)}</h3>
            <div class="card-footer">
              <span class="card-developer">${escapeHtml(game.developer || 'GlitchNest')}</span>
              <div class="card-stats">
                <span class="stat-rating">★ ${game.rating || '5.0'}</span>
              </div>
            </div>
          </div>
        </a>
      `).join('');
    } catch (e) {
      console.warn('Could not load recommendations:', e);
    }
  }

  // Error State display
  function showErrorState(title, message) {
    if (showcaseContainer) {
      showcaseContainer.innerHTML = `
        <div style="background: #ffffff; border: 3px solid var(--ink-main); border-radius: 20px; padding: 3rem 2rem; text-align: center; box-shadow: 6px 6px 0 var(--ink-main);">
          <h2 style="font-size: 2.2rem; color: #b91c1c; margin-bottom: 0.5rem;">${escapeHtml(title)}</h2>
          <p style="font-family: var(--font-hand); font-size: 1.25rem; color: var(--ink-muted); margin-bottom: 1.5rem; max-width: 480px; margin-left: auto; margin-right: auto;">${escapeHtml(message)}</p>
          <a href="index.html" class="action-btn">
            &larr; RETURN TO SUNNY CATALOG
          </a>
        </div>
      `;
    }
  }

  // Escape HTML helper
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Toast Notification
  function showToast(msg) {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
      <span>${escapeHtml(msg)}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  // Kickoff
  loadGame();
});
