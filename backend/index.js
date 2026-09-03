import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { db, initDb } from './db.js';

const app = express();
app.use(cors());
app.use(express.json());

const RAWG_API_KEY = process.env.RAWG_API_KEY;
const RAWG_BASE = 'https://api.rawg.io/api';

await initDb();

// ---------- CRUD ----------

// GET /games?status=completed|backlog|recommendation
app.get('/games', async (req, res) => {
  const { status } = req.query;
  const result = status
    ? await db.execute({ sql: 'SELECT * FROM games WHERE status = ? ORDER BY id DESC', args: [status] })
    : await db.execute('SELECT * FROM games ORDER BY id DESC');
  res.json(result.rows);
});

// POST /games
app.post('/games', async (req, res) => {
  const { title, status, genre, rating, notes, cover_image_url, date_completed, source } = req.body;
  if (!title || !status) {
    return res.status(400).json({ error: 'title and status are required' });
  }
  const result = await db.execute({
    sql: `INSERT INTO games (title, status, genre, rating, notes, cover_image_url, date_completed, source)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [title, status, genre || null, rating || null, notes || null, cover_image_url || null, date_completed || null, source || 'manual'],
  });
  const newGame = await db.execute({
    sql: 'SELECT * FROM games WHERE id = ?',
    args: [Number(result.lastInsertRowid)],
  });
  res.status(201).json(newGame.rows[0]);
});

// PUT /games/:id
app.put('/games/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await db.execute({ sql: 'SELECT * FROM games WHERE id = ?', args: [id] });
  if (existing.rows.length === 0) return res.status(404).json({ error: 'Game not found' });

  const merged = { ...existing.rows[0], ...req.body };
  await db.execute({
    sql: `UPDATE games SET title=?, status=?, genre=?, rating=?, notes=?, cover_image_url=?, date_completed=? WHERE id=?`,
    args: [merged.title, merged.status, merged.genre, merged.rating, merged.notes, merged.cover_image_url, merged.date_completed, id],
  });
  const updated = await db.execute({ sql: 'SELECT * FROM games WHERE id = ?', args: [id] });
  res.json(updated.rows[0]);
});

// DELETE /games/:id
app.delete('/games/:id', async (req, res) => {
  const id = Number(req.params.id);
  const result = await db.execute({ sql: 'DELETE FROM games WHERE id = ?', args: [id] });
  if (result.rowsAffected === 0) return res.status(404).json({ error: 'Game not found' });
  res.status(204).send();
});

// ---------- Auto-recommendations via RAWG ----------

app.get('/recommendations/auto', async (req, res) => {
  if (!RAWG_API_KEY) {
    return res.status(500).json({ error: 'RAWG_API_KEY is not set in .env' });
  }

  try {
    const completedResult = await db.execute(
      "SELECT genre, rating FROM games WHERE status = 'completed' AND genre IS NOT NULL"
    );
    const completed = completedResult.rows;

    if (completed.length === 0) {
      return res.json({ message: 'Mark some games as completed with genres first.', results: [] });
    }

    const genreScores = {};
    completed.forEach(g => {
      String(g.genre).split(',').map(s => s.trim().toLowerCase()).forEach(genre => {
        if (!genre) return;
        genreScores[genre] = (genreScores[genre] || 0) + (g.rating || 3);
      });
    });

    const topGenres = Object.entries(genreScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([genre]) => genre);

    if (topGenres.length === 0) {
      return res.json({ message: 'No usable genres found on completed games.', results: [] });
    }

    const allGamesResult = await db.execute('SELECT title FROM games');
    const alreadyTracked = new Set(allGamesResult.rows.map(g => String(g.title).toLowerCase()));

    const url = `${RAWG_BASE}/games?key=${RAWG_API_KEY}&genres=${encodeURIComponent(topGenres.join(','))}&ordering=-rating&page_size=20`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`RAWG API error: ${response.status}`);
    }
    const data = await response.json();

    const suggestions = (data.results || [])
      .filter(g => !alreadyTracked.has(g.name.toLowerCase()))
      .slice(0, 10)
      .map(g => ({
        title: g.name,
        cover_image_url: g.background_image,
        genre: (g.genres || []).map(x => x.name).join(', '),
        rawg_rating: g.rating,
      }));

    res.json({ basedOnGenres: topGenres, results: suggestions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch recommendations', details: err.message });
  }
});

app.get('/', (req, res) => res.send('Game tracker API is running.'));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Game tracker backend running on http://localhost:${PORT}`));
