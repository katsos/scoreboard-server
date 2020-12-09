const bodyParser = require('body-parser');
const cors = require('cors');
const crypto = require('crypto');
const get = require('lodash.get');
const express = require('express');
const morgan = require('morgan');
const { Pool } = require('pg');

const onlineUsers = [];
const port = process.env.PORT || 3000;

const isProduction = process.env.NODE_ENV === 'production';
const connectionString = `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`;

const app = express();
app.use(cors());
app.use(morgan('common'));
app.use(bodyParser.json()); // support JSON-encoded bodies

const client = new Pool({
  connectionString: isProduction ? process.env.DATABASE_URL : connectionString,
  ssl: isProduction || {
    rejectUnauthorized: false,
  },
});
client.connect();

app.get('/', (req, res) => {
  res.send({
    online_users: onlineUsers.length,
  });
});

app.get('/scoreboard', async (req, res) => {
  try {
    const response = await client.query('SELECT * from users ORDER BY score DESC');
    const scoreboard = get(response, 'rows', []);
    res.json(scoreboard);
  } catch (err) {
    console.error(err);
    res.status(500).json(err);
  }
});

app.post('/score', async (req, res) => {
  const { username, score, token } = req.body;
  const isScoreInvalid = !score && score !== 0;
  if (isScoreInvalid || !username || !token) {
    return res.status(403).end('Invalid parameters');
  }

  const userFound = onlineUsers.find(user => user.ip === req.ip);

  if (!userFound) {
    return res.status(403).end('No matching session');
  }

  console.log(JSON.stringify({ onlineUsers }));
  if (!onlineUsers.find(u => u.token === token)) {
    return res.status(403).end('Authorization failed!');
  }

  await addScore(req.body);
  res.status(200).end('Score added!');
});

app.post('/session', (req, res) => {
  const { ip } = req;
  const token = generateKey();

  const user = onlineUsers.find(u => u.ip === ip);
  if (!user) {
    onlineUsers.push({ ip, token });
  }

  res.status(201).json({ token });
});

app.listen(port, () => {
  console.log(`Server listening to port ${port}`);
});

function generateKey() {
  let sha = crypto.createHash('sha256');
  sha.update(Math.random().toString());
  return sha.digest('hex');
}

async function addScore(data) {
  try {
    const score = parseInt(data.score);
    const res = await client.query('INSERT INTO users(username, score) VALUES ($1, $2)', [data.username, score]);
    return res.rows[0];
  } catch (err) {
    console.error(err.stack);
    return {};
  }
}
