// Change this to your deployed backend URL once it's hosted (e.g. Render).
// Keep 'http://localhost:3001' for local development.
const API_BASE = 'http://localhost:3001';

// ---------- Tab switching ----------
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
    btn.classList.add('active');
    document.getElementById(`${btn.dataset.tab}-tab`).classList.remove('hidden');
  });
});

// ---------- Card rendering ----------
function renderCard(game) {
  const div = document.createElement('div');
  div.className = 'game-card';
  div.innerHTML = `
    ${game.cover_image_url ? `<img src="${game.cover_image_url}" alt="${game.title}" />` : ''}
    <div class="card-body">
      <h4>${game.title}</h4>
      ${game.genre ? `<p>${game.genre}</p>` : ''}
      ${game.rating ? `<p>⭐ ${game.rating}/5</p>` : ''}
      ${game.notes ? `<p>${game.notes}</p>` : ''}
    </div>
    <div class="card-actions">
      <button data-action="delete" data-id="${game.id}">Delete</button>
    </div>
  `;
  div.querySelector('[data-action="delete"]').addEventListener('click', async () => {
    await fetch(`${API_BASE}/games/${game.id}`, { method: 'DELETE' });
    loadAllTabs();
  });
  return div;
}

// ---------- Load games per status ----------
async function loadGamesByStatus(status, gridId) {
  const grid = document.getElementById(gridId);
  grid.innerHTML = 'Loading...';
  try {
    const res = await fetch(`${API_BASE}/games?status=${status}`);
    const games = await res.json();
    grid.innerHTML = '';
    if (games.length === 0) {
      grid.innerHTML = '<p style="color:#9295a8">Nothing here yet.</p>';
      return;
    }
    games.forEach(g => grid.appendChild(renderCard(g)));
  } catch (err) {
    grid.innerHTML = '<p style="color:#e06666">Could not load games. Is the backend running?</p>';
  }
}

function loadAllTabs() {
  loadGamesByStatus('completed', 'completed-grid');
  loadGamesByStatus('backlog', 'backlog-grid');
  loadGamesByStatus('recommendation', 'manual-rec-grid');
}

// ---------- Add game form ----------
document.getElementById('add-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    title: document.getElementById('title').value,
    status: document.getElementById('status').value,
    genre: document.getElementById('genre').value,
    rating: document.getElementById('rating').value || null,
    cover_image_url: document.getElementById('cover_image_url').value,
    notes: document.getElementById('notes').value,
  };
  await fetch(`${API_BASE}/games`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  e.target.reset();
  loadAllTabs();
});

// ---------- Auto recommendations ----------
document.getElementById('get-auto-recs').addEventListener('click', async () => {
  const status = document.getElementById('auto-rec-status');
  const grid = document.getElementById('auto-rec-grid');
  status.textContent = 'Fetching suggestions from RAWG...';
  grid.innerHTML = '';
  try {
    const res = await fetch(`${API_BASE}/recommendations/auto`);
    const data = await res.json();
    if (data.error) {
      status.textContent = `Error: ${data.error}`;
      return;
    }
    if (data.message) {
      status.textContent = data.message;
      return;
    }
    status.textContent = `Based on your top genres: ${data.basedOnGenres.join(', ')}`;
    data.results.forEach(g => grid.appendChild(renderCard(g)));
  } catch (err) {
    status.textContent = 'Could not reach backend.';
  }
});

// ---------- Init ----------
loadAllTabs();
