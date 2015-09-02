var express = require('express');
var app = express();
var fs = require('fs');
var sender = require('./app/sender.js');
var token = require('./app/config.json').token;

app.post('/' + token, function (req, res) {
    var request;
    var data;

    req.on('data', function (data) {
        sender(JSON.parse(data.toString()));
    });

    req.on('end', function () {
        res.status(200).send({});
    });
});

app.use(function (err, req, res, next) {
    console.error('\nError at middleware', err);

    res.writeHead(500);
    res.end('500 Internal Server Error');
});

app.on('error', function (res, req) {
    console.log('There is an error!');
});

app.listen(4750, function () {
    console.log('Started listening on a port 4750...');
});
