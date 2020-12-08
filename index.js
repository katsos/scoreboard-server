const bodyParser = require('body-parser');
const cors = require('cors');
const crypto = require('crypto');
const entities = require('entities');
const express = require('express');
const morgan = require('morgan');
const { Client } = require('pg');

/* APP CONFIGS */
const app = express();
const onlineUsers = [];

app.use(cors());
app.use(morgan('dev'));
app.listen(8888);
// support JSON-encoded bodies
app.use(bodyParser.json());
// support URL-encoded bodies
app.use(
  bodyParser.urlencoded({
    extended: true
  })
);

const client = new Client();
(async () => {
  try {
    await client.connect();
  } catch (err) {
    console.error(err);
  }
})();

app.get('/', (req, res) => {
  res.send({
    online_users: onlineUsers.length
  });
});

/**
 * /scores route has no restrictions.
 * Anyone can see scores.
 */
app.get('/scores', (req, res) => {
  let response = [];
  db.each(
    'SELECT * from users ORDER BY highscore DESC',
    (err, row) => response.push(row),
    () => res.send(response)
  );
});

app.post('/score', async (req, res) => {
  if (!req.body.username || !req.body.highscore || !req.body.token) {
    return res.status(403).end('Invalid parameters');
  }

  const userFound = onlineUsers.find(user => user.ip === req.ip);

  if (!userFound) {
    return res.status(403).end('No matching session');
  }

  if (!isAuthorizedUser(user.ip, req.body.token)) {
    return res.status(403).end('Authorization failed!');
  }

  await addScore(req.body);
  res.status(200).end('Score added!');
});

app.post('/session', (req, res) => {
  const userIp = req.ip;
  const usertoken = generateKey();

  let found = onlineUsers.find(user => {
    if (user.ip !== userIp) return;
    user.token = usertoken;
    return true;
  });

  if (!found) onlineUsers.push({ ip: userIp, token: usertoken });
  res.header('token', usertoken).send();
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
  data.highscore = entities.encode(data.highscore.toString());

  try {
    const res = await client.query('INSERT INTO users(username, highscore) VALUES ($1, $2)', [
      data.username,
      data.highscore
    ]);
    return res.rows[0];
  } catch (err) {
    console.error(err.stack);
    return {};
  }
}
