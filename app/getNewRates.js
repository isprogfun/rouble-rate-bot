'use strict';

/**
 * Запрашивает курс каждую минуту, итого 60 запросов в час с IP
 * Лимит для публичного доступа 2,000 calls/hour/IP https://developer.yahoo.com/yql/faq/
 * Полученные данные сохраняет в базу, ищет пользователей, которым надо отправить новый курс
 */
let https = require('https');
let fs = require('fs');

let sender = require(__dirname + '/sender.js');
let path =
    '/v1/public/yql?q=select+*+from+yahoo.finance.xchange+where+pair+=+"USDRUB,EURRUB"' +
    '&format=json&env=store%3A%2F%2Fdatatables.org%2Falltableswithkeys&callback=';

let MongoClient = require('mongodb').MongoClient;
let url = 'mongodb://localhost:27017/roubleratebot';

let getNewRates = function (db) {
    let request = https.request({
        hostname: 'query.yahooapis.com',
        path: path,
        port: 443,
        method: 'GET'
    }, function (res) {
        let data = '';

        res.on('data', function (chunk) {
            data += chunk;
        });

        res.on('end', function () {
            console.log('Got new rates at: ' + new Date() + '\n', data);

            let rates = JSON.parse(data).query.results.rate;

            if (rates) {
                // Сохраняем курс в базу
                rates.forEach(function (rate) {
                    db.collection('rates').update({
                        title: rate.id.substring(0, 3)
                    }, {
                        title: rate.id.substring(0, 3),
                        rate: Number(rate.Rate).toFixed(2)
                    }, {
                        upsert: true
                    });
                });

                /**
                 * Перебираем юзеров, которые следят за изменениями
                 * проверяем для каждой записи, надо ли отправить им новый курс
                 */
                db.collection('users').find({sendChanges: true}).toArray(function (err, users) {
                    if (err) { throw err; }

                    if (!users || !users.length) { return; }

                    // Для каждого юзера
                    users.forEach(function (user) {
                        // Перебираем сохранённые курсы
                        // TODO: Не выбирать юзеров, у которых нет lastSend
                        if (user.lastSend) {
                            Object.keys(user.lastSend).some(function (title) {
                                // Перебираем полученные курсы
                                return rates.some(function (rate) {
                                    // Если совпала валюта
                                    if (title === rate.id.substring(0, 3)) {
                                        // Проверяем разницу и если она больше — посылаем значение
                                        if (Math.abs(user.lastSend[title] - rate.Rate) > user.difference) {
                                            sender.sendRate(user.id, db);
                                        }

                                        return true;
                                    }
                                });
                            });
                        } else {
                            sender.sendRate(user.id, db);
                        }
                    });
                });
            }
        });
    });

    request.on('error', function (err) {
        console.log('Problem with request: ' + err.message);
    });

    request.end();
};

MongoClient.connect(url, function (err, db) {
    if (err) { throw err; }

    setInterval(function () {
        getNewRates(db);
    }, 1000 * 60);
});
