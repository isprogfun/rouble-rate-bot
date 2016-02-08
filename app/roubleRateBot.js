'use strict';

let express = require('express');
let app = express();
let sender = require(__dirname + '/sender.js');
let token = require(__dirname + '/config.json').token;

let MongoClient = require('mongodb').MongoClient;
let url = 'mongodb://localhost:27017/roubleratebot';

app.use(function (req, res, next) {
    MongoClient.connect(url).then(function (db) {
        console.log('Connected to db');
        req.db = db;
        next();
    }).catch (function (error) {
        connection = undefined;
        next(error);
    });
});

app.post('/' + token, function (req, res) {
    req.on('data', function (data) {
        sender.handleMessage(req, JSON.parse(data.toString()));
    });

    req.on('end', function () {
        res.status(200).send({});
    });
});

app.use(function (err, req, res, next) {
    console.error('\nError at middleware', err);

    req.db.close();
    res.writeHead(500);
    res.end('500 Internal Server Error');
});

app.on('error', function (res, req) {
    console.log('There is an error!');
});

app.listen(4750, function () {
    console.log('Started listening on a port 4750...');
});
