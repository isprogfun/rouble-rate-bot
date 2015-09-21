var sender = require('./sender');
var MongoClient = require('mongodb').MongoClient;
var url = 'mongodb://localhost:27017/roubleratebot';

MongoClient.connect(url, function (err, db) {
    if (err) {
        throw err;
    }

    console.log('Connected to db');

    db.collection('rates').find().toArray(function (err, collection) {
        if (err) {
            throw err;
        }

        var text = collection.map(function (rate) {
            var result = (Math.round(rate.rate * 100) / 100).toString();

            if (result.length === 4) {
                result = result + '0';
            }

            return rate.title + ': ' + result + ' руб';
        }).join('\n');

        db.collection('users').find().toArray(function (err, collection) {
            if (err) {
                throw err;
            }

            collection.forEach(function (user) {
                if (user.notifications) {
                    sender.sendMessage(user.id, text);
                }
            });

            db.close();
        });
    });
});
