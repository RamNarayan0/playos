require('dotenv').config();
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const { pool } = require('./src/lib/db');

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || (dev ? "localhost" : "0.0.0.0");
const port = process.env.PORT || 3000;
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  // Global socket telemetry registry state
  let activeConnectionsCount = 0;

  // --- REDIS ADAPTER PREPARATION LAYER ---
  if (process.env.REDIS_URL) {
    try {
      const { createClient } = require('redis');
      const { createAdapter } = require('@socket.io/redis-adapter');
      const pubClient = createClient({ url: process.env.REDIS_URL });
      const subClient = pubClient.duplicate();
      Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
        io.adapter(createAdapter(pubClient, subClient));
        console.log("Redis Horizontal Scaling Adapter configured");
      });
    } catch (e) {
      console.warn("Redis dependencies omitted, running single-node memory adapter");
    }
  }

  // --- CRYPTOGRAPHIC SOCKET AUTHORIZATION MIDDLEWARE ---
  const { getToken } = require('next-auth/jwt');
  io.use(async (socket, next) => {
    try {
      const token = await getToken({
        req: socket.request,
        secret: process.env.NEXTAUTH_SECRET || "default_secure_playos_secret_token_12345",
      });

      if (token && token.id) {
        socket.user = { id: parseInt(token.id), role: token.role };
        return next();
      }

      // Local testing smoothing fallback if socket config omits cookies
      if (process.env.NODE_ENV !== "production") {
        socket.user = { id: 1, role: 'player', isDevFallback: true };
        return next();
      }

      return next(new Error("Unauthorized: Cryptographic NextAuth verification failed"));
    } catch (err) {
      console.log(JSON.stringify({ level: 'METRIC', metric: 'socket.auth_middleware_failures', value: 1, timestamp: new Date().toISOString() }));
      console.error("Socket Auth Middleware Error:", err);
      return next(new Error("Internal Socket Authentication Error"));
    }
  });

  // --- SOCKET CONNECTION HANDLER WITH TELEMETRY AND EVENT ROUTES ---
  io.on('connection', (socket) => {
    // Track active connections
    activeConnectionsCount++;
    const connectTime = Date.now();
    console.log(JSON.stringify({
      level: 'METRIC',
      metric: 'socket.connection_established',
      active_connections: activeConnectionsCount,
      user_id: socket.user?.id,
      timestamp: new Date().toISOString()
    }));

    // Track start time for latency tracking

    // Record start time for latency tracking
    socket.__connectStart = Date.now();

    // Handle disconnects
    socket.on('disconnect', (reason) => {
      const durationSec = (Date.now() - socket.__connectStart) / 1000;
      console.log(JSON.stringify({
        level: 'METRIC',
        metric: 'socket.connection_terminated',
        active_connections: activeConnectionsCount,
        duration_sec: durationSec,
        reason,
        user_id: socket.user?.id,
        timestamp: new Date().toISOString()
      }));
      activeConnectionsCount--;
    });

    // Reconnect attempt tracking
    socket.on('reconnect_attempt', () => {
      console.log('Socket reconnect attempt by user:', socket.user?.id);
    });

    // Simple request forwarding
    socket.on('send_request', (data) => {
      io.emit('request_received', data);
    });

    // Request acceptance flow with push notification
    socket.on('request_accepted', async (data) => {
      try {
        const updatedRes = await pool.query(`
          SELECT m.*, t.name as turf_name, t.location as turf_location, u.name as host_name
          FROM matches m
          LEFT JOIN turfs t ON m.turf_id = t.id
          LEFT JOIN users u ON m.host_id = u.id
          WHERE m.id = $1
        `, [data.matchId]);

        if (updatedRes.rows.length > 0) {
          const updatedMatch = updatedRes.rows[0];
          io.emit('match_updated', updatedMatch);

          const subRes = await pool.query('SELECT * FROM push_subscriptions WHERE user_id = $1', [data.userId]);
          if (subRes.rows.length > 0) {
            const webpush = require('web-push');
            webpush.setVapidDetails(
              'mailto:support@playos.io',
              process.env.NEXT_PUBLIC_VAPID_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIsqP93bLezXwgG8g',
              process.env.VAPID_PRIVATE_KEY || 'sK__eZ_496K5eZ15-WwN-QnN7Y7x69i4q0-uWjA0uWw'
            );
            const sub = subRes.rows[0];
            const pushConfig = {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh_key, auth: sub.auth_key }
            };
            const payload = JSON.stringify({
              title: 'Request Accepted!',
              body: `You have been accepted into ${updatedMatch.name} at ${updatedMatch.turf_name}. Tap to view chat.`,
              url: '/player'
            });
            webpush.sendNotification(pushConfig, payload).catch(err => console.error('Web Push Error:', err));
          }
        }
      } catch (err) {
        console.error('Socket Error during request_accepted:', err);
      }
    });

    // Secure match chat room handling
    socket.on('join_match_room', async (data) => {
      const matchId = parseInt(data.matchId);
      const userId = socket.user.id;
      try {
        const authRes = await pool.query(`
          SELECT id FROM matches WHERE id = $1 AND host_id = $2
          UNION
          SELECT match_id FROM match_players WHERE match_id = $1 AND user_id = $2
        `, [matchId, userId]);
        const isAuthorized = authRes.rows.length > 0 || socket.user.isDevFallback;
        if (isAuthorized) {
          const roomName = `match:${matchId}`;
          socket.join(roomName);
          console.log(`Verified User ${userId} admitted securely to room ${roomName}`);
        } else {
          console.log(JSON.stringify({
            level: 'METRIC',
            metric: 'socket.room_unauthorized_blocks',
            user_id: userId,
            match_id: matchId,
            timestamp: new Date().toISOString()
          }));
          console.warn(`Unauthorized room entry attempt by User ${userId} for Match ${matchId}`);
          socket.emit('room_error', { message: 'Unauthorized access to match room' });
        }
      } catch (err) {
        console.error('Room admission authorization error:', err);
      }
    });

    socket.on('leave_match_room', (data) => {
      const roomName = `match:${data.matchId}`;
      socket.leave(roomName);
      console.log(`User ${socket.user.id} left room ${roomName}`);
    });

    // Message handling within a match room
    socket.on('send_message', async (data) => {
      const { matchId, content, type = 'text' } = data;
      const userId = socket.user.id;
      const roomName = `match:${matchId}`;
      try {
        const insertRes = await pool.query(`
          INSERT INTO messages (match_id, sender_user_id, message_content, message_type)
          VALUES ($1, $2, $3, $4)
          RETURNING *
        `, [matchId, userId, content, type]);
        const newMessage = insertRes.rows[0];
        const userRes = await pool.query('SELECT name FROM users WHERE id = $1', [userId]);
        newMessage.sender_name = userRes.rows[0]?.name || 'Unknown User';
        io.to(roomName).emit('receive_message', newMessage);
      } catch (error) {
        console.error('Socket Error during send_message:', error);
      }
    });
  });

  httpServer
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});
