import sender from './sender.js';
import { MongoClient, MongoError, Db } from 'mongodb';
import express from 'express';

var config = require('./config.json');

var app = express();
var db: Db;

app.use(function (req, res, next) {
    if (!db) {
        MongoClient.connect('mongodb://localhost:27017', {}, (err: MongoError, client: MongoClient) => {
            if (err) {
                next(err);
            }

            db = client.db('roubleratebot');
            console.log((new Date()).toISOString() + ": Connected to db");
            next();
        })
    }
    else {
        next();
    }
});
app.post("/" + config.token, function (req: express.Request, res: express.Response) {
    req.on('data', function (data) {
        sender.handleMessage(db, JSON.parse(data.toString()));
    });
    req.on('end', function () {
        res.status(200).send({});
    });
});
app.use(function (err: Error, req: express.Request, res: express.Response, next: express.NextFunction) {
    console.log((new Date()).toISOString() + ": Error at middleware", err);
    res.sendStatus(500);
});
app.on('error', function (res, req) {
    console.log((new Date()).toISOString() + ": There is an error");
});
app.listen(4750, function () {
    console.log((new Date()).toISOString() + ": Started listening on port 4750...");
});
