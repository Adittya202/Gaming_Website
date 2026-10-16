/**
 * GlitchNest Portal - Homepage & Catalog Engine (main.js)
 * High-performance client-side filtering, search, and dynamic grid rendering.
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM References
  const searchInput = document.getElementById('catalogSearch');
  const searchClearBtn = document.getElementById('searchClearBtn');
  const categoryPillsContainer = document.getElementById('categoryPills');
  const gamesGrid = document.getElementById('gamesGrid');
  const gameCountEl = document.getElementById('gameCount');
  const heroSpotlightEl = document.getElementById('heroSpotlight');

  let allGames = [];
  let currentCategory = 'All';
  let searchQuery = '';

  // Fetch games from backend API
  async function fetchCatalog() {
    try {
      const res = await fetch('/api/games');
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      allGames = await res.json();
      
      initHeroSpotlight();
      initCategoryPills();
      renderCatalog();
    } catch (err) {
      console.error('Failed to load games catalog:', err);
      gamesGrid.innerHTML = `
        <div class="empty-catalog-state">
          <div class="empty-title">CONNECTION ERROR</div>
          <p style="color: var(--text-dim); margin-bottom: 1rem;">Could not connect to GlitchNest database server.</p>
          <button class="action-btn" onclick="location.reload()">RETRY CONNECTION</button>
        </div>
      `;
    }
  }

  // Hero Spotlight Showcase
  function initHeroSpotlight() {
    if (!heroSpotlightEl) return;
    
    // Pick featured game or fallback to the first entry
    const featured = allGames.find(g => g.featured) || allGames[0];
    if (!featured) return;

    heroSpotlightEl.innerHTML = `
      <article class="hero-card">
        <div class="hero-media-wrapper">
          <img src="${featured.thumbnail}" alt="${featured.title}" class="hero-thumbnail" loading="eager">
          <div class="hero-media-overlay"></div>
        </div>
        <div class="hero-content">
          <div class="spotlight-tag">FEATURED GAME OF THE WEEK</div>
          <h2 class="hero-title">${escapeHtml(featured.title)}</h2>
          <p class="hero-synopsis">${escapeHtml(featured.synopsis || featured.description)}</p>
          
          <div class="hero-meta">
            <span class="meta-pill highlight">★ ${featured.rating || '4.9'}</span>
            <span class="meta-pill">⚡ ${featured.plays || '100K+'} PLAYS</span>
            <span class="meta-pill">${featured.category}</span>
            <span class="meta-pill">${featured.version || 'v1.0'}</span>
          </div>

          <div class="hero-actions">
            <a href="play.html?id=${encodeURIComponent(featured.slug || featured.id)}" class="action-btn hero-play-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
              PLAY NOW
            </a>
            <button class="action-btn action-btn-secondary" onclick="shareGame('${escapeHtml(featured.title)}', '${encodeURIComponent(featured.slug || featured.id)}')">
              SHARE
            </button>
          </div>
        </div>
      </article>
    `;
  }

  // Build Category Pills dynamically based on catalog categories
  function initCategoryPills() {
    if (!categoryPillsContainer) return;

    const categories = ['All'];
    allGames.forEach(g => {
      if (g.category && !categories.includes(g.category)) {
        categories.push(g.category);
      }
    });

    categoryPillsContainer.innerHTML = categories.map(cat => `
      <button class="pill-btn ${cat === currentCategory ? 'active' : ''}" data-category="${cat}">
        ${cat}
      </button>
    `).join('');

    categoryPillsContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.pill-btn');
      if (!btn) return;
      
      categoryPillsContainer.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCategory = btn.getAttribute('data-category');
      renderCatalog();
    });
  }

  // Filter and Render the YouTube-Style 16:9 Grid
  function renderCatalog() {
    const q = searchQuery.toLowerCase().trim();

    const filtered = allGames.filter(game => {
      // Category Match
      const matchesCategory = currentCategory === 'All' || game.category === currentCategory;
      if (!matchesCategory) return false;

      // Real-time Search Match (Title, Tags, Developer, Description)
      if (!q) return true;

      const titleMatch = (game.title || '').toLowerCase().includes(q);
      const descMatch = (game.description || '').toLowerCase().includes(q);
      const tagMatch = (game.tags || []).some(t => t.toLowerCase().includes(q));
      const devMatch = (game.developer || '').toLowerCase().includes(q);

      return titleMatch || descMatch || tagMatch || devMatch;
    });

    // Update Counter
    if (gameCountEl) {
      gameCountEl.textContent = `${filtered.length} TITLE${filtered.length === 1 ? '' : 'S'} ONLINE`;
    }

    // Empty State
    if (filtered.length === 0) {
      gamesGrid.innerHTML = `
        <div class="empty-catalog-state">
          <div class="empty-title">NO MATCHING TITLES LOCATED</div>
          <p style="color: var(--text-dim); margin-bottom: 1.25rem;">
            No arcade game matched your query "${escapeHtml(searchQuery)}" in category "${escapeHtml(currentCategory)}".
          </p>
          <button class="action-btn action-btn-secondary" id="resetFilterBtn">
            CLEAR FILTERS
          </button>
        </div>
      `;
      const resetBtn = document.getElementById('resetFilterBtn');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          searchInput.value = '';
          searchQuery = '';
          searchClearBtn.style.display = 'none';
          currentCategory = 'All';
          initCategoryPills();
          renderCatalog();
        });
      }
      return;
    }

    // Strict 16:9 Thumbnail YouTube-Style Cards
    gamesGrid.innerHTML = filtered.map(game => {
      const gameId = encodeURIComponent(game.slug || game.id);
      return `
        <a href="play.html?id=${gameId}" class="game-card" data-id="${gameId}">
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
            <p class="card-desc">${escapeHtml(game.description || '')}</p>
            <div class="card-footer">
              <span class="card-developer">${escapeHtml(game.developer || 'GlitchNest')}</span>
              <div class="card-stats">
                <span class="stat-rating">★ ${game.rating || '4.9'}</span>
                <span>${game.plays || '10K'}</span>
              </div>
            </div>
          </div>
        </a>
      `;
    }).join('');
  }

  // Real-time Search Handler with input clearing
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      if (searchClearBtn) {
        searchClearBtn.style.display = searchQuery ? 'block' : 'none';
      }
      renderCatalog();
    });

    if (searchClearBtn) {
      searchClearBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        searchClearBtn.style.display = 'none';
        searchInput.focus();
        renderCatalog();
      });
    }

    // Quick focus keyboard shortcut '/'
    window.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== searchInput) {
        e.preventDefault();
        searchInput.focus();
      }
    });
  }

  // Utility to prevent XSS in client templating
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Global Share Utility
  window.shareGame = function(title, slug) {
    const url = `${window.location.origin}/play.html?id=${slug}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        showToast(`Copied link for "${title}" to clipboard!`);
      }).catch(() => {
        prompt('Copy game link:', url);
      });
    } else {
      prompt('Copy game link:', url);
    }
  };

  // Toast Notification System
  window.showToast = function(msg) {
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
  };

  // Kickoff
  fetchCatalog();
});
