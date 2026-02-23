import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const db = new Database('trana.db');
const JWT_SECRET = process.env.JWT_SECRET || 'trana-emergency-secret-2026';

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL, -- civilian, doctor, police, volunteer, command, admin
    status TEXT DEFAULT 'active',
    verified INTEGER DEFAULT 0,
    lat REAL,
    lng REAL,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL, -- medical, fire, crime, accident, disaster
    status TEXT DEFAULT 'triggered', -- triggered, accepted, escalating, resolved, closed
    severity TEXT DEFAULT 'medium',
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    reporter_id INTEGER,
    responder_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(reporter_id) REFERENCES users(id),
    FOREIGN KEY(responder_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS incident_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    incident_id INTEGER,
    action TEXT,
    user_id INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(incident_id) REFERENCES incidents(id)
  );

  CREATE TABLE IF NOT EXISTS safe_walks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    start_lat REAL,
    start_lng REAL,
    end_lat REAL,
    end_lng REAL,
    status TEXT DEFAULT 'active', -- active, completed, panic
    check_in_interval INTEGER,
    last_check_in DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

  // Seed Data
  const seedUsers = [
    { name: 'Command Center', email: 'admin@trana.org', password: 'password123', role: 'admin' },
    { name: 'Dr. Sarah Chen', email: 'sarah@trana.org', password: 'password123', role: 'doctor' },
    { name: 'Officer Mike Ross', email: 'mike@trana.org', password: 'password123', role: 'police' },
    { name: 'Jane Civilian', email: 'jane@trana.org', password: 'password123', role: 'civilian' },
  ];

  for (const u of seedUsers) {
    const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(u.email);
    if (!exists) {
      const hashedPassword = await bcrypt.hash(u.password, 10);
      db.prepare('INSERT INTO users (name, email, password, role, verified) VALUES (?, ?, ?, ?, 1)')
        .run(u.name, u.email, hashedPassword, u.role);
    }
  }


async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  app.use(express.json());

  // Real-time state
  const clients = new Map<number, WebSocket>();

  // Escalation Logic (runs every 30s)
  setInterval(() => {
    // Tier 1: 0-60s (500m) - Handled by initial broadcast
    
    // Tier 2: 60s+ (1km expansion)
    const tier2 = db.prepare(`
      UPDATE incidents 
      SET status = 'escalating', updated_at = CURRENT_TIMESTAMP 
      WHERE status = 'triggered' 
      AND (strftime('%s','now') - strftime('%s', created_at)) BETWEEN 60 AND 119
    `).run();

    // Tier 3: 120s+ (Hospital Notification)
    const tier3 = db.prepare(`
      UPDATE incidents 
      SET status = 'hospital_notified', updated_at = CURRENT_TIMESTAMP 
      WHERE status = 'escalating' 
      AND (strftime('%s','now') - strftime('%s', created_at)) BETWEEN 120 AND 179
    `).run();

    // Tier 4: 180s+ (Command Control Alert)
    const tier4 = db.prepare(`
      UPDATE incidents 
      SET status = 'command_alerted', updated_at = CURRENT_TIMESTAMP 
      WHERE status = 'hospital_notified' 
      AND (strftime('%s','now') - strftime('%s', created_at)) > 180
    `).run();
    
    if (tier2.changes > 0 || tier3.changes > 0 || tier4.changes > 0) {
      console.log(`Escalation cycle complete: T2:${tier2.changes}, T3:${tier3.changes}, T4:${tier4.changes}`);
      
      // Broadcast updates for all escalated incidents
      const updatedIncidents = db.prepare("SELECT * FROM incidents WHERE status IN ('escalating', 'hospital_notified', 'command_alerted')").all() as any[];
      updatedIncidents.forEach(inc => {
        broadcastToResponders({ type: 'incident_updated', incident: inc });
        broadcastStats(); // Update stats for everyone
      });
    }
  }, 30000);

  wss.on('connection', (ws, req) => {
    let userId: number | null = null;

    ws.on('message', (message) => {
      const data = JSON.parse(message.toString());
      if (data.type === 'auth') {
        try {
          const decoded = jwt.verify(data.token, JWT_SECRET) as any;
          userId = decoded.id;
          if (userId) clients.set(userId, ws);
        } catch (e) {}
      }
      
      if (data.type === 'location_update' && userId) {
        db.prepare('UPDATE users SET lat = ?, lng = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?')
          .run(data.lat, data.lng, userId);
        
        // Broadcast location to admins/command center
        const locationData = JSON.stringify({
          type: 'user_location_update',
          userId,
          lat: data.lat,
          lng: data.lng
        });
        
        const admins = db.prepare("SELECT id FROM users WHERE role IN ('admin', 'command')").all() as any[];
        admins.forEach(admin => {
          const client = clients.get(admin.id);
          if (client && client.readyState === WebSocket.OPEN && admin.id !== userId) {
            client.send(locationData);
          }
        });
      }
    });

    ws.on('close', () => {
      if (userId) clients.delete(userId);
    });
  });

  // OAuth Routes
  app.get('/api/auth/url', (req, res) => {
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers.host;
    const baseUrl = `${protocol}://${host}`;
    const redirectUri = `${baseUrl}/auth/callback`;
    
    // Mock OAuth URL
    const authUrl = `${baseUrl}/auth/mock-provider?redirect_uri=${encodeURIComponent(redirectUri)}`;
    res.json({ url: authUrl });
  });

  app.get('/auth/mock-provider', (req, res) => {
    const { redirect_uri } = req.query;
    res.send(`
      <html>
        <body style="font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #F5F5F7;">
          <div style="background: white; padding: 2rem; border-radius: 2rem; border: 1px solid #e5e5e5; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.05);">
            <h2 style="margin-bottom: 1rem;">Mock OAuth Provider</h2>
            <p style="color: #666; margin-bottom: 2rem;">TRANA OS is requesting access to your profile.</p>
            <a href="${redirect_uri}?code=mock_code_123" style="background: #10b981; color: white; padding: 0.75rem 2rem; border-radius: 1rem; text-decoration: none; font-weight: bold;">Authorize TRANA</a>
          </div>
        </body>
      </html>
    `);
  });

  app.get('/auth/callback', (req, res) => {
    const { code } = req.query;
    // In a real app, exchange code for tokens
    // For mock, we'll just log in a default user or create one
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get('jane@trana.org') as any;
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET);
    
    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ 
                type: 'OAUTH_AUTH_SUCCESS', 
                token: '${token}',
                user: ${JSON.stringify({ id: user.id, name: user.name, email: user.email, role: user.role })}
              }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication successful. This window should close automatically.</p>
        </body>
      </html>
    `);
  });

  // API Routes
  app.post('/api/auth/register', async (req, res) => {
    const { name, email, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    try {
      const result = db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)')
        .run(name, email, hashedPassword, role);
      const token = jwt.sign({ id: result.lastInsertRowid, role }, JWT_SECRET);
      res.json({ token, user: { id: result.lastInsertRowid, name, email, role } });
    } catch (e) {
      res.status(400).json({ error: 'Email already exists' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
    if (user && await bcrypt.compare(password, user.password)) {
      const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET);
      res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  });

  // Broadcast to responders
  const broadcastToResponders = (data: any) => {
    const responders = db.prepare("SELECT id FROM users WHERE role IN ('doctor', 'police', 'volunteer', 'command', 'admin') AND status = 'active'").all() as any[];
    const broadcastData = JSON.stringify(data);
    responders.forEach(r => {
      const client = clients.get(r.id);
      if (client && client.readyState === WebSocket.OPEN) {
        client.send(broadcastData);
      }
    });
  };

  const broadcastStats = () => {
    const totalIncidents = db.prepare('SELECT COUNT(*) as count FROM incidents').get() as any;
    const activeResponders = db.prepare("SELECT COUNT(*) as count FROM users WHERE role IN ('doctor', 'police', 'volunteer') AND status = 'active'").get() as any;
    // Use IST (UTC+5:30) for today's count
    const resolvedToday = db.prepare("SELECT COUNT(*) as count FROM incidents WHERE status = 'resolved' AND date(updated_at, '+5 hours', '30 minutes') = date('now', '+5 hours', '30 minutes')").get() as any;
    
    const stats = {
      totalIncidents: totalIncidents.count,
      activeResponders: activeResponders.count,
      resolvedToday: resolvedToday.count,
      safetyScore: 84
    };

    const broadcastData = JSON.stringify({ type: 'stats_update', stats });
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(broadcastData);
      }
    });
  };

  app.post('/api/incidents', (req, res) => {
    const { type, lat, lng, reporterId, severity } = req.body;
    const result = db.prepare('INSERT INTO incidents (type, lat, lng, reporter_id, severity) VALUES (?, ?, ?, ?, ?)')
      .run(type, lat, lng, reporterId, severity);
    
    const incidentId = result.lastInsertRowid;
    
    broadcastToResponders({
      type: 'new_incident',
      incident: { id: incidentId, type, lat, lng, severity,language: language || 'en',status: 'triggered', created_at: new Date().toISOString() }
    });
    broadcastStats();

    res.json({ id: incidentId });
  });

  app.post('/api/incidents/:id/accept', (req, res) => {
    const { id } = req.params;
    const { responderId } = req.body;
    
    db.prepare("UPDATE incidents SET status = 'accepted', responder_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(responderId, id);
    
    const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(id) as any;
    
    // Notify reporter
    const reporterClient = clients.get(incident.reporter_id);
    if (reporterClient && reporterClient.readyState === WebSocket.OPEN) {
      reporterClient.send(JSON.stringify({
        type: 'incident_accepted',
        incidentId: id,
        responderId
      }));
    }

    // Update all responders
    broadcastToResponders({
      type: 'incident_updated',
      incident
    });
    broadcastStats();

    res.json({ status: 'ok' });
  });

  app.post('/api/incidents/:id/resolve', (req, res) => {
    const { id } = req.params;
    db.prepare("UPDATE incidents SET status = 'resolved', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(id);
    
    const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(id) as any;
    
    broadcastToResponders({
      type: 'incident_updated',
      incident
    });
    broadcastStats();

    res.json({ status: 'ok' });
  });

  app.post('/api/safewalk/start', (req, res) => {
    const { userId, startLat, startLng, endLat, endLng, interval } = req.body;
    const result = db.prepare('INSERT INTO safe_walks (user_id, start_lat, start_lng, end_lat, end_lng, check_in_interval) VALUES (?, ?, ?, ?, ?, ?)')
      .run(userId, startLat, startLng, endLat, endLng, interval);
    res.json({ id: result.lastInsertRowid });
  });

  app.get('/api/incidents/active', (req, res) => {
    const incidents = db.prepare("SELECT * FROM incidents WHERE status != 'resolved' AND status != 'closed'").all();
    res.json(incidents);
  });

  app.get('/api/stats/summary', (req, res) => {
    const totalIncidents = db.prepare('SELECT COUNT(*) as count FROM incidents').get() as any;
    const activeResponders = db.prepare("SELECT COUNT(*) as count FROM users WHERE role IN ('doctor', 'police', 'volunteer') AND status = 'active'").get() as any;
    // Use IST (UTC+5:30) for today's count
    const resolvedToday = db.prepare("SELECT COUNT(*) as count FROM incidents WHERE status = 'resolved' AND date(updated_at, '+5 hours', '30 minutes') = date('now', '+5 hours', '30 minutes')").get() as any;
    
    res.json({
      totalIncidents: totalIncidents.count,
      activeResponders: activeResponders.count,
      resolvedToday: resolvedToday.count,
      safetyScore: 84 // Mock score
    });
  });

  app.get('/api/intelligence/risk', async (req, res) => {
    try {
      const history = db.prepare('SELECT type, lat, lng, created_at FROM incidents LIMIT 50').all();
      // In a real app, we'd call Gemini here. For now, we'll return mock data if API key is missing
      // but the service is ready in src/services/geminiService.ts
      res.json({
        highRiskZones: [
          { lat: 51.505, lng: -0.09, risk: 0.8 },
          { lat: 51.51, lng: -0.1, risk: 0.6 }
        ],
        peakRiskHours: "18:00 - 22:00",
        anomalyLikelihood: 12
      });
    } catch (e) {
      res.status(500).json({ error: 'Failed to fetch intelligence' });
    }
  });

  // Vite Integration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (req, res) => res.sendFile(path.resolve('dist/index.html')));
  }

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`TRANA OS running on http://localhost:${PORT}`);
  });
}

startServer();
