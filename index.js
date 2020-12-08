const bodyParser = require('body-parser');
const cors = require('cors');
const crypto = require('crypto');
const get = require('lodash.get');
const entities = require('entities');
const express = require('express');
const morgan = require('morgan');
const { Client } = require('pg');

/* APP CONFIGS */
const app = express();
const onlineUsers = [];
const port = process.env.PORT || 3000;

app.use(cors());
app.use(morgan('dev'));
// support JSON-encoded bodies
app.use(bodyParser.json());
// support URL-encoded bodies
app.use(
  bodyParser.urlencoded({
    extended: true,
  }),
);

const client = new Client({
  ssl: {
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
  if (!req.body.username || !req.body.score || !req.body.token) {
    return res.status(403).end('Invalid parameters');
  }

  const userFound = onlineUsers.find(user => user.ip === req.ip);

  if (!userFound) {
    return res.status(403).end('No matching session');
  }

  if (!isAuthorizedUser(userFound.ip, req.body.token)) {
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

/**
 * Search all online users if those credentials belong to any of them.
 * @returns {undefined|integer} Undefined for non found user, or the index of user in "onlineUsers"
 */
function isAuthorizedUser(ip, token) {
  let is = onlineUsers.find(user => user.ip === ip && user.token === token);
  return !!is;
}

async function addScore(data) {
  data.username = entities.encode(data.username);
  data.score = entities.encode(data.score.toString());

  try {
    const res = await client.query('INSERT INTO users(username, score) VALUES ($1, $2)', [data.username, data.score]);
    return res.rows[0];
  } catch (err) {
    console.error(err.stack);
    return {};
  }
}
