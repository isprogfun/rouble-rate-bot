const express = require('express');

const sender = require('./sender.js');

const config = require('./config.json');

const MongoClient = require('mongodb').MongoClient;

const app = express();
let db;

app.use((req, res, next) => {
    if (!db) {
        MongoClient.connect(config.db).then((_db) => {
            console.log(`${(new Date()).toISOString()}: Connected to db`);
            db = _db;

            next();
        }).catch((err) => {
            next(err);
        });
    } else {
        next();
    }
});

app.post(`/${config.token}`, (req, res) => {
    req.on('data', (data) => {
        sender.handleMessage(req, db, JSON.parse(data.toString()));
    });

    req.on('end', () => {
        res.status(200).send({});
    });
});

app.use((err, req, res, next) => {
    console.log(`${(new Date()).toISOString()}: Error at middleware`, err);

    res.writeHead(500).end('Internal Server Error');
});

app.on('error', (res, req) => {
    console.log(`${(new Date()).toISOString()}: There is an error`);
});

app.listen(4750, () => {
    console.log(`${(new Date()).toISOString()}: Started listening on a port 4750...`);
});
