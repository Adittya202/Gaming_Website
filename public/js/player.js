/**
 * GlitchNest Portal - Game Runner & Monetization Hub (player.js)
 * Fullscreen API management, dynamic iframe loader, control guide generator,
 * AdSense hooks, and recommendations engine.
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const stageContainer = document.getElementById('stageContainer');
  const gameFrame = document.getElementById('gameFrame');
  const stageLoader = document.getElementById('stageLoader');
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const restartBtn = document.getElementById('restartBtn');
  const shareBtn = document.getElementById('shareBtn');
  const favoriteBtn = document.getElementById('favoriteBtn');
  
  // Metadata fields
  const gameTitleEl = document.getElementById('gameTitle');
  const gameVersionBadge = document.getElementById('gameVersionBadge');
  const gameCategoryBadge = document.getElementById('gameCategoryBadge');
  const gameDevCredit = document.getElementById('gameDevCredit');
  const gameRatingEl = document.getElementById('gameRating');
  const gamePlaysEl = document.getElementById('gamePlays');
  const controlsGridEl = document.getElementById('controlsGrid');
  const gameInstructionsEl = document.getElementById('gameInstructions');
  const goalBannerEl = document.getElementById('goalBanner');
  const recommendedGridEl = document.getElementById('recommendedGrid');

  // Extract ID from URL (?id=...)
  const urlParams = new URLSearchParams(window.location.search);
  const gameId = urlParams.get('id');

  let currentGame = null;

  if (!gameId) {
    showErrorState('NO GAME ID SPECIFIED', 'Please select a game from the GlitchNest arcade catalog.');
    return;
  }

  // Load Game Details
  async function loadGame() {
    try {
      const res = await fetch(`/api/games/${encodeURIComponent(gameId)}`);
      if (!res.ok) {
        throw new Error(`Game '${gameId}' not found in registry.`);
      }

      currentGame = await res.json();
      renderGameDetails(currentGame);
      loadGameStage(currentGame);
      loadRecommendations(currentGame.id);
      checkFavoriteStatus(currentGame.id);
    } catch (err) {
      console.error(err);
      showErrorState('GAME NOT FOUND', `Could not find an active game registry with ID: "${gameId}".`);
    }
  }

  // Inject metadata into DOM
  function renderGameDetails(game) {
    document.title = `${game.title} - GlitchNest Arcade`;

    if (gameTitleEl) gameTitleEl.textContent = game.title;
    if (gameVersionBadge) gameVersionBadge.textContent = game.version || 'v1.0';
    if (gameCategoryBadge) gameCategoryBadge.textContent = game.category || 'Arcade';
    if (gameDevCredit) gameDevCredit.textContent = game.developer || 'GlitchNest Studios';
    if (gameRatingEl) gameRatingEl.textContent = `★ ${game.rating || '4.9'}`;
    if (gamePlaysEl) gamePlaysEl.textContent = `${game.plays || '10K'} PLAYS`;

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
      gameInstructionsEl.textContent = game.instructions || game.description || 'Use controls to play.';
    }

    if (goalBannerEl) {
      goalBannerEl.innerHTML = `<strong>HIGH-SCORE OBJECTIVE:</strong> ${escapeHtml(game.highScoreGoal || 'Reach the top tier on the GlitchNest leaderboards!')}`;
    }
  }

  // Set up iframe viewport
  function loadGameStage(game) {
    if (!gameFrame) return;

    if (stageLoader) stageLoader.classList.remove('hidden');

    gameFrame.src = game.executable;

    gameFrame.onload = () => {
      setTimeout(() => {
        if (stageLoader) stageLoader.classList.add('hidden');
        // Focus iframe for immediate keyboard capture
        try {
          gameFrame.contentWindow.focus();
        } catch (e) {}
      }, 350);
    };

    gameFrame.onerror = () => {
      if (stageLoader) {
        stageLoader.innerHTML = `
          <div style="color: var(--neon-red); font-family: var(--font-mono); font-weight: 700; text-align: center;">
            [STAGE INITIALIZATION FAILURE]<br>
            Unable to load source executable: ${escapeHtml(game.executable)}
          </div>
        `;
      }
    };
  }

  // HTML5 Fullscreen API Integration
  if (fullscreenBtn && stageContainer) {
    fullscreenBtn.addEventListener('click', toggleFullscreen);

    function toggleFullscreen() {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        if (stageContainer.requestFullscreen) {
          stageContainer.requestFullscreen();
        } else if (stageContainer.webkitRequestFullscreen) {
          stageContainer.webkitRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        }
      }
    }

    // Sync button text on fullscreen change
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);

    function handleFsChange() {
      const isFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
      fullscreenBtn.innerHTML = isFs 
        ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg> Exit Fullscreen`
        : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg> Fullscreen`;
    }
  }

  // Restart Game Action
  if (restartBtn && gameFrame) {
    restartBtn.addEventListener('click', () => {
      if (stageLoader) stageLoader.classList.remove('hidden');
      const currentSrc = gameFrame.src;
      gameFrame.src = '';
      setTimeout(() => {
        gameFrame.src = currentSrc;
      }, 100);
      showToast('Game stage restarted.');
    });
  }

  // Share Game Action
  if (shareBtn) {
    shareBtn.addEventListener('click', () => {
      const url = window.location.href;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => {
          showToast('Game link copied to clipboard!');
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
        recommendedGridEl.innerHTML = `<p style="color: var(--text-dim);">No other games currently online.</p>`;
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
                <span class="stat-rating">★ ${game.rating || '4.9'}</span>
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
    if (stageContainer) {
      stageContainer.innerHTML = `
        <div style="height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #090d16; text-align: center; padding: 2rem;">
          <h2 style="font-size: 2rem; color: var(--neon-red); margin-bottom: 0.5rem; text-shadow: 0 0 15px rgba(239, 68, 68, 0.4);">${escapeHtml(title)}</h2>
          <p style="color: var(--text-muted); margin-bottom: 1.5rem; max-width: 480px;">${escapeHtml(message)}</p>
          <a href="index.html" class="action-btn">
            RETURN TO CATALOG
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
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
