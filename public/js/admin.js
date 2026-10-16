/**
 * GlitchNest Portal - Owner Upload & Admin Dashboard Engine (admin.js)
 * Passcode authentication gateway, game deployment submission,
 * catalog management (delete, toggle visibility), and validation.
 */

document.addEventListener('DOMContentLoaded', () => {
  const authOverlay = document.getElementById('authOverlay');
  const authForm = document.getElementById('authForm');
  const passcodeInput = document.getElementById('passcodeInput');
  const authErrorMsg = document.getElementById('authErrorMsg');
  const logoutBtn = document.getElementById('logoutBtn');

  const deployForm = document.getElementById('deployForm');
  const catalogTableBody = document.getElementById('catalogTableBody');
  const adminGameCount = document.getElementById('adminGameCount');
  const presetBtn = document.getElementById('presetBtn');

  const TOKEN_KEY = 'glitchnest_admin_token';
  let adminToken = sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || '';

  // Initialize Auth Gateway
  if (adminToken) {
    verifyAndUnlock(adminToken);
  } else {
    showAuthGateway();
  }

  function showAuthGateway() {
    if (authOverlay) authOverlay.style.display = 'flex';
  }

  function hideAuthGateway() {
    if (authOverlay) authOverlay.style.display = 'none';
  }

  if (authForm) {
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = passcodeInput.value.trim();
      if (!code) return;

      try {
        const res = await fetch('/api/admin/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ passcode: code })
        });
        const data = await res.json();

        if (data.success && data.token) {
          adminToken = data.token;
          sessionStorage.setItem(TOKEN_KEY, adminToken);
          hideAuthGateway();
          authErrorMsg.textContent = '';
          loadAdminCatalog();
          showToast('Access Granted. Welcome, Admin.');
        } else {
          authErrorMsg.textContent = 'ACCESS DENIED: Invalid passcode key.';
        }
      } catch (err) {
        authErrorMsg.textContent = 'Server verification failure.';
      }
    });
  }

  async function verifyAndUnlock(token) {
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: token })
      });
      const data = await res.json();
      if (data.success) {
        hideAuthGateway();
        loadAdminCatalog();
      } else {
        sessionStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(TOKEN_KEY);
        showAuthGateway();
      }
    } catch (e) {
      showAuthGateway();
    }
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      sessionStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(TOKEN_KEY);
      adminToken = '';
      showAuthGateway();
      showToast('Logged out of Admin Portal.');
    });
  }

  // Auto-generate slug from title
  const gameTitleInput = document.getElementById('gameTitleInput');
  const gameSlugInput = document.getElementById('gameSlugInput');
  if (gameTitleInput && gameSlugInput) {
    gameTitleInput.addEventListener('input', () => {
      if (!gameSlugInput.dataset.manual) {
        gameSlugInput.value = gameTitleInput.value
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
      }
    });
    gameSlugInput.addEventListener('input', () => {
      gameSlugInput.dataset.manual = 'true';
    });
  }

  // =========================================================
  // Thumbnail Studio & Strict 16:9 Aspect Ratio Enforcement
  // =========================================================
  const tabUploadLocal = document.getElementById('tabUploadLocal');
  const tabEnterUrl = document.getElementById('tabEnterUrl');
  const localUploadSection = document.getElementById('localUploadSection');
  const urlInputSection = document.getElementById('urlInputSection');
  const thumbFileInput = document.getElementById('thumbFileInput');
  const dropzoneClickArea = document.getElementById('dropzoneClickArea');
  const thumbPreviewImg = document.getElementById('thumbPreviewImg');
  const ratioStatusBadge = document.getElementById('ratioStatusBadge');
  const previewDimsBadge = document.getElementById('previewDimsBadge');
  const cropNoticeBox = document.getElementById('cropNoticeBox');
  const cropWarningText = document.getElementById('cropWarningText');
  const autoCrop169Btn = document.getElementById('autoCrop169Btn');
  const letterbox169Btn = document.getElementById('letterbox169Btn');
  const uploadStatusMsg = document.getElementById('uploadStatusMsg');
  const gameThumbInput = document.getElementById('gameThumbInput');

  let currentLoadedImage = null;
  let currentLoadedFilename = 'thumbnail.png';

  // Tab switching
  if (tabUploadLocal && tabEnterUrl) {
    tabUploadLocal.addEventListener('click', () => {
      tabUploadLocal.classList.add('active');
      tabEnterUrl.classList.remove('active');
      if (localUploadSection) localUploadSection.style.display = 'block';
      if (urlInputSection) urlInputSection.style.display = 'none';
    });

    tabEnterUrl.addEventListener('click', () => {
      tabEnterUrl.classList.add('active');
      tabUploadLocal.classList.remove('active');
      if (localUploadSection) localUploadSection.style.display = 'none';
      if (urlInputSection) urlInputSection.style.display = 'block';
    });
  }

  // Live URL input change syncs preview
  if (gameThumbInput) {
    gameThumbInput.addEventListener('input', () => {
      const url = gameThumbInput.value.trim();
      if (url) {
        if (thumbPreviewImg) thumbPreviewImg.src = url;
        if (ratioStatusBadge) {
          ratioStatusBadge.textContent = 'Custom Path Linked';
          ratioStatusBadge.className = 'ratio-badge-pill';
        }
        if (cropNoticeBox) cropNoticeBox.style.display = 'none';
      }
    });
  }

  // Trigger file browsing
  if (dropzoneClickArea && thumbFileInput) {
    dropzoneClickArea.addEventListener('click', () => {
      thumbFileInput.click();
    });

    thumbFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        processSelectedLocalFile(e.target.files[0]);
      }
    });
  }

  // Drag and drop handlers
  if (localUploadSection) {
    ['dragenter', 'dragover'].forEach(name => {
      localUploadSection.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        localUploadSection.classList.add('drag-over');
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      localUploadSection.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        localUploadSection.classList.remove('drag-over');
      });
    });

    localUploadSection.addEventListener('drop', (e) => {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        processSelectedLocalFile(e.dataTransfer.files[0]);
      }
    });
  }

  // Process Local Image File & Enforce 16:9 Ratio
  function processSelectedLocalFile(file) {
    if (!file.type.startsWith('image/')) {
      showUploadStatus('Error: Please select a valid picture file (PNG, JPG, WebP).', 'error');
      return;
    }

    currentLoadedFilename = file.name;
    const reader = new FileReader();

    reader.onload = (e) => {
      const rawDataUrl = e.target.result;
      const img = new Image();

      img.onload = () => {
        currentLoadedImage = img;
        const width = img.naturalWidth;
        const height = img.naturalHeight;
        const ratio = width / height;
        const targetRatio = 16 / 9; // ~1.77778

        if (previewDimsBadge) previewDimsBadge.textContent = `${width} × ${height}`;

        // Check if ratio matches 16:9 within 3% tolerance
        const isRatio16x9 = Math.abs(ratio - targetRatio) <= 0.05;

        if (isRatio16x9) {
          // Exact or near-exact 16:9 picture!
          if (ratioStatusBadge) {
            ratioStatusBadge.textContent = `✅ Valid 16:9 Ratio`;
            ratioStatusBadge.className = 'ratio-badge-pill valid';
          }
          if (cropNoticeBox) cropNoticeBox.style.display = 'none';

          // Upload image to server
          uploadProcessedThumbnail(rawDataUrl, file.name);
        } else {
          // Ratio mismatch: enforce 16:9 with friendly auto-crop tools
          if (ratioStatusBadge) {
            ratioStatusBadge.textContent = `⚠️ Ratio: ${ratio.toFixed(2)}:1 (Needs 16:9)`;
            ratioStatusBadge.className = 'ratio-badge-pill invalid';
          }
          
          if (cropNoticeBox) cropNoticeBox.style.display = 'block';
          if (cropWarningText) {
            cropWarningText.innerHTML = `⚠️ Selected picture is <strong>${width}×${height} (${ratio.toFixed(2)}:1)</strong>.<br>GlitchNest requires strict <strong>16:9 ratio</strong> cards. Choose an option:`;
          }
          
          // Show raw image preview
          if (thumbPreviewImg) thumbPreviewImg.src = rawDataUrl;
          showUploadStatus('Picture loaded. Please click an auto-crop option below to enforce 16:9 ratio before uploading.', 'error');
        }
      };

      img.onerror = () => {
        showUploadStatus('Failed to decode image file.', 'error');
      };

      img.src = rawDataUrl;
    };

    reader.readAsDataURL(file);
  }

  // 16:9 Center Crop Tool
  if (autoCrop169Btn) {
    autoCrop169Btn.addEventListener('click', () => {
      if (!currentLoadedImage) return;

      const img = currentLoadedImage;
      const targetW = 1280;
      const targetH = 720;
      const targetRatio = 16 / 9;
      const imgRatio = img.naturalWidth / img.naturalHeight;

      let cropX = 0;
      let cropY = 0;
      let cropW = img.naturalWidth;
      let cropH = img.naturalHeight;

      if (imgRatio > targetRatio) {
        // Image is wider than 16:9 -> crop left & right
        cropW = img.naturalHeight * targetRatio;
        cropX = (img.naturalWidth - cropW) / 2;
      } else {
        // Image is taller than 16:9 -> crop top & bottom
        cropH = img.naturalWidth / targetRatio;
        cropY = (img.naturalHeight - cropH) / 2;
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, targetW, targetH);

      const croppedDataUrl = canvas.toDataURL('image/png', 0.95);
      if (previewDimsBadge) previewDimsBadge.textContent = '1280 × 720 (16:9 Cropped)';
      if (ratioStatusBadge) {
        ratioStatusBadge.textContent = '✅ 16:9 Auto-Cropped';
        ratioStatusBadge.className = 'ratio-badge-pill valid';
      }
      if (cropNoticeBox) cropNoticeBox.style.display = 'none';

      uploadProcessedThumbnail(croppedDataUrl, currentLoadedFilename);
    });
  }

  // 16:9 Letterbox / Fit Tool
  if (letterbox169Btn) {
    letterbox169Btn.addEventListener('click', () => {
      if (!currentLoadedImage) return;

      const img = currentLoadedImage;
      const targetW = 1280;
      const targetH = 720;

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');

      // Soft pastel paper background
      ctx.fillStyle = '#f8fbff';
      ctx.fillRect(0, 0, targetW, targetH);

      const scale = Math.min(targetW / img.naturalWidth, targetH / img.naturalHeight);
      const drawW = img.naturalWidth * scale;
      const drawH = img.naturalHeight * scale;
      const drawX = (targetW - drawW) / 2;
      const drawY = (targetH - drawH) / 2;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, drawX, drawY, drawW, drawH);

      const letterboxedDataUrl = canvas.toDataURL('image/png', 0.95);
      if (previewDimsBadge) previewDimsBadge.textContent = '1280 × 720 (16:9 Fitted)';
      if (ratioStatusBadge) {
        ratioStatusBadge.textContent = '✅ 16:9 Fitted';
        ratioStatusBadge.className = 'ratio-badge-pill valid';
      }
      if (cropNoticeBox) cropNoticeBox.style.display = 'none';

      uploadProcessedThumbnail(letterboxedDataUrl, currentLoadedFilename);
    });
  }

  // Upload to Express Backend
  async function uploadProcessedThumbnail(dataUrl, originalFilename) {
    showUploadStatus('☁ Uploading 16:9 thumbnail to server...', '');

    const gameSlug = gameSlugInput ? gameSlugInput.value.trim() : 'custom-game';

    try {
      const res = await fetch('/api/upload/thumbnail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': adminToken
        },
        body: JSON.stringify({
          imageBase64: dataUrl,
          filename: originalFilename,
          slug: gameSlug
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // Update input field and preview
        if (gameThumbInput) gameThumbInput.value = data.url;
        if (thumbPreviewImg) thumbPreviewImg.src = data.url;

        showUploadStatus(`✓ Uploaded successfully: ${data.url} (${(data.size / 1024).toFixed(1)} KB)`, 'success');
        showToast('16:9 Thumbnail uploaded and saved!');
      } else {
        showUploadStatus(`Upload failed: ${data.error || 'Server rejected file'}`, 'error');
      }
    } catch (err) {
      console.error(err);
      showUploadStatus('Network error during thumbnail upload.', 'error');
    }
  }

  function showUploadStatus(msg, type) {
    if (!uploadStatusMsg) return;
    uploadStatusMsg.style.display = 'block';
    uploadStatusMsg.textContent = msg;
    uploadStatusMsg.className = `upload-status-msg ${type}`;
  }

  // Quick Preset / Demo Fill Button for rapid testing
  if (presetBtn) {
    presetBtn.addEventListener('click', () => {
      const randomId = Math.floor(100 + Math.random() * 900);
      document.getElementById('gameTitleInput').value = `Matrix Pulse #${randomId}`;
      document.getElementById('gameSlugInput').value = `matrix-pulse-${randomId}`;
      document.getElementById('gameCategoryInput').value = 'Arcade';
      document.getElementById('gameDescInput').value = 'Cybernetic reflex arcade experience. Deflect neon laser bursts across a shifting grid.';
      document.getElementById('gameControlsInput').value = 'W A S D : Directional Thrusters\nMouse Aim : Target Matrix\nSpace : Pulse Wave';
      document.getElementById('gameThumbInput').value = '/assets/thumbnails/quantum-pulse.svg';
      document.getElementById('gameExecInput').value = '/games/demo-game/index.html';
      document.getElementById('gameVersionInput').value = 'v1.0.0';
      document.getElementById('gameDevInput').value = 'GlitchNest Labs';
      document.getElementById('gameFeaturedInput').checked = false;
      document.getElementById('gameVisibleInput').checked = true;
      showToast('Sample game data auto-filled.');
    });
  }

  /**
   * Helper to resolve executable link for admin launch buttons
   */
  function resolveExecutableUrl(raw) {
    if (!raw) return '#';
    let url = String(raw).trim();
    if (!url) return '#';
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//i.test(url)) return url;
    if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) return url;
    if (url.startsWith('games/')) return '/' + url;
    if (/^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}/.test(url)) return 'https://' + url;
    return url;
  }

  // Load Admin Catalog Table
  async function loadAdminCatalog() {
    if (!catalogTableBody) return;
    try {
      const res = await fetch('/api/games?all=true', {
        headers: { 'x-admin-token': adminToken }
      });
      if (!res.ok) throw new Error('Unauthorized');

      const games = await res.json();
      if (adminGameCount) {
        adminGameCount.textContent = `${games.length} REGISTERED`;
      }

      catalogTableBody.innerHTML = games.map(game => {
        const isVisible = game.visible !== false;
        const gameId = encodeURIComponent(game.slug || game.id);
        const directExecUrl = resolveExecutableUrl(game.executable);
        return `
          <tr data-id="${gameId}">
            <td>
              <div class="table-game-cell">
                <img src="${game.thumbnail || '/assets/thumbnails/default.svg'}" alt="" class="table-thumb">
                <div>
                  <span class="table-game-title">${escapeHtml(game.title)}</span>
                  <span class="table-game-slug">${escapeHtml(game.slug || game.id)}</span>
                </div>
              </div>
            </td>
            <td>
              <span class="tag-badge ${game.category === 'Action' ? 'cyan' : 'violet'}">
                ${escapeHtml(game.category || 'Arcade')}
              </span>
            </td>
            <td>
              <span class="status-badge ${isVisible ? 'published' : 'hidden'}">
                ${isVisible ? 'PUBLISHED' : 'HIDDEN'}
              </span>
              ${game.featured ? '<span class="status-badge" style="color:var(--neon-amber); margin-left:4px;">FEATURED</span>' : ''}
            </td>
            <td>
              <span style="font-family: var(--font-mono); font-size: 0.8rem;">
                ★ ${game.rating || '4.9'} (${game.plays || '10K'})
              </span>
            </td>
            <td>
              <div class="table-actions">
                <a href="play.html?id=${gameId}" target="_blank" class="table-btn" title="View Game Details Page">
                  ▶ Details
                </a>
                <a href="${directExecUrl}" target="_blank" rel="noopener noreferrer" class="table-btn" title="Launch Executable Directly">
                  ⚡ Launch
                </a>
                <button class="table-btn" onclick="toggleVisibility('${gameId}', ${isVisible})" title="Toggle Visibility">
                  ${isVisible ? 'Hide' : 'Show'}
                </button>
                <button class="table-btn delete" onclick="deleteGame('${gameId}', '${escapeHtml(game.title)}')" title="Delete from database">
                  Delete
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error(err);
      catalogTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--neon-red); padding: 1.5rem;">Failed to fetch catalog. Please verify session authorization.</td></tr>`;
    }
  }

  // Handle Game Deployment Form Submission
  if (deployForm) {
    deployForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const title = document.getElementById('gameTitleInput').value.trim();
      const slug = document.getElementById('gameSlugInput').value.trim();
      const category = document.getElementById('gameCategoryInput').value;
      const description = document.getElementById('gameDescInput').value.trim();
      const controlsRaw = document.getElementById('gameControlsInput').value.trim();
      const thumbnail = document.getElementById('gameThumbInput').value.trim() || '/assets/thumbnails/default.svg';
      let executable = document.getElementById('gameExecInput').value.trim();
      const version = document.getElementById('gameVersionInput').value.trim() || 'v1.0.0';
      const developer = document.getElementById('gameDevInput').value.trim() || 'GlitchNest Creator';
      const featured = document.getElementById('gameFeaturedInput').checked;
      const visible = document.getElementById('gameVisibleInput').checked;

      // Validation
      if (!title) {
        showToast('Error: Game title is required.');
        return;
      }
      if (!executable) {
        showToast('Error: Executable link or path is required.');
        return;
      }

      // Auto-prefix https:// if domain format without protocol
      if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//i.test(executable) && !executable.startsWith('/') && /^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}/.test(executable)) {
        executable = 'https://' + executable;
      }

      // Parse controls
      const controls = controlsRaw.split('\n').filter(Boolean).map(line => {
        const parts = line.split(':');
        return {
          key: (parts[0] || 'Key').trim(),
          action: (parts[1] || line).trim()
        };
      });

      const payload = {
        title,
        slug: slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        category,
        description,
        synopsis: description,
        controls,
        thumbnail,
        executable,
        version,
        developer,
        featured,
        visible,
        tags: [category, 'Arcade', 'GlitchNest']
      };

      try {
        const res = await fetch('/api/games', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-token': adminToken
          },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (res.ok && data.success) {
          showToast(`Game "${title}" successfully published to GlitchNest!`);
          deployForm.reset();
          loadAdminCatalog();
        } else {
          showToast(`Deployment error: ${data.error || 'Failed to register game.'}`);
        }
      } catch (err) {
        showToast('Server communication failure during deployment.');
      }
    });
  }

  // Global Visibility Toggle Action
  window.toggleVisibility = async function(id, currentVisible) {
    try {
      const res = await fetch(`/api/games/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': adminToken
        },
        body: JSON.stringify({ visible: !currentVisible })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Game status updated to: ${!currentVisible ? 'PUBLISHED' : 'HIDDEN'}`);
        loadAdminCatalog();
      } else {
        showToast('Failed to update status.');
      }
    } catch (e) {
      showToast('Network error updating visibility.');
    }
  };

  // Global Delete Action
  window.deleteGame = async function(id, title) {
    if (!confirm(`Are you sure you want to PERMANENTLY REMOVE "${title}" (${id}) from the database?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/games/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: {
          'x-admin-token': adminToken
        }
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Game "${title}" deleted successfully.`);
        loadAdminCatalog();
      } else {
        showToast(`Deletion failed: ${data.error || 'Unknown error'}`);
      }
    } catch (e) {
      showToast('Network error during deletion.');
    }
  };

  // Helper Escape HTML
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Toast System
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
});
