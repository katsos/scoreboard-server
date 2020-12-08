'use strict';
const express = require('express');
const entities = require('entities');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const cors = require('cors');
const morgan  = require('morgan')

/* APP CONFIGS */
let app = express();
app.use(cors());
app.use(morgan('dev'))
app.listen(8888);
const bodyParser = require('body-parser');
app.use(bodyParser.json()); // support JSON-encoded bodies
app.use(bodyParser.urlencoded({ // support URL-encoded bodies
  extended: true
}));

let db = new sqlite3.cached.Database('./db.sqlite3');
let onlineUsers = [];

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
    db.each('SELECT * from users ORDER BY highscore DESC', (err, row) => response.push(row), () => res.send(response));
});

app.post('/score', (req, res) => {
    if (!req.body.username || !req.body.highscore || !req.body.token)return res.status(403).end('Invalid parameters');

    let found = onlineUsers.find(user => {
        if (user.ip !== req.ip) return;
        if (!isAuthorizedUser(user.ip, req.body.token)) return res.status(403).end('Authorization failed!');
        addScore(req.body,() => res.status(200).end('Score added!'));
        return true;
    });

    if (!found) res.status(403).end('No matching session');
});

app.post('/session', (req, res) => {
    const userIp = req.ip;
    const usertoken = generateKey();

    let found = onlineUsers.find(user => {
        if (user.ip !== userIp) return;
        user.token = usertoken;
        return true;
    });

    if (!found) onlineUsers.push({ip: userIp, token: usertoken});
    res.header('token', usertoken).send();
});

function generateKey() {
    let sha = crypto.createHash('sha256');
    sha.update(Math.random().toString());
    return sha.digest('hex');
};

/**
 * Search all online users if those credentials belong to any of them.
 * @returns {undefined|integer} Undefined for non found user, or the index of user in "onlineUsers"
 */
function isAuthorizedUser(ip, token) {
    let is = onlineUsers.find(user => user.ip === ip && user.token === token);
    return (!!is);
}

function addScore(data, cb) {
    data.username = entities.encode(data.username);
    data.highscore = entities.encode(data.highscore.toString());

    db.serialize(() => {
        db.run('INSERT INTO users(username, highscore) VALUES (?,?)', [data.username, data.highscore]);
        cb();
    });
}
