var https = require('https');
var fs = require('fs');
var request;
var path =
    '/v1/public/yql?q=select+*+from+yahoo.finance.xchange+where+pair+=+"USDRUB,EURRUB"' +
    '&format=json&env=store%3A%2F%2Fdatatables.org%2Falltableswithkeys&callback=';

var MongoClient = require('mongodb').MongoClient;
var url = 'mongodb://localhost:27017/roubleratebot';

request = https.request({
    hostname: 'query.yahooapis.com',
    path: path,
    port: 443,
    method: 'GET'
}, function (res) {
    var data = '';

    res.on('data', function (chunk) {
        data += chunk;
    });

    res.on('end', function () {
        console.log('Got new rates');

        MongoClient.connect(url, function (err, db) {
            if (err) {
                throw err;
            }

            var results = JSON.parse(data).query.results;

            console.log('Connected to db');

            if (results) {
                db.collection('rates').remove();

                results.rate.forEach(function (rate) {
                    var result = {};

                    result.title = rate.id.substring(0, 3);
                    result.rate = rate.Rate;

                    db.collection('rates').insertOne(result);
                });
            }

            db.close();
        });
    });
});

request.on('error', function (err) {
    console.log('Problem with request: ' + err.message);
});

request.end();
