"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sender_js_1 = __importDefault(require("./sender.js"));
const mongodb_1 = require("mongodb");
const express_1 = __importDefault(require("express"));
var config = require('./config.json');
var app = express_1.default();
var db;
app.use(function (req, res, next) {
    if (!db) {
        mongodb_1.MongoClient.connect('mongodb://localhost:27017', {}, (err, client) => {
            if (err) {
                next(err);
            }
            db = client.db('roubleratebot');
            console.log((new Date()).toISOString() + ": Connected to db");
            next();
        });
    }
    else {
        next();
    }
});
app.post("/" + config.token, function (req, res) {
    req.on('data', function (data) {
        sender_js_1.default.handleMessage(db, JSON.parse(data.toString()));
    });
    req.on('end', function () {
        res.status(200).send({});
    });
});
app.use(function (err, req, res, next) {
    console.log((new Date()).toISOString() + ": Error at middleware", err);
    res.sendStatus(500);
});
app.on('error', function (res, req) {
    console.log((new Date()).toISOString() + ": There is an error");
});
app.listen(4750, function () {
    console.log((new Date()).toISOString() + ": Started listening on port 4750...");
});
