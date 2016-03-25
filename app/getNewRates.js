'use strict';

/**
 * Запрашивает курс каждую минуту, итого 60 запросов в час с IP
 * Лимит для публичного доступа 2,000 calls/hour/IP https://developer.yahoo.com/yql/faq/
 * Полученные данные сохраняет в базу, ищет пользователей, которым надо отправить новый курс
 */
let https = require('https');
let fs = require('fs');

let sender = require(__dirname + '/sender.js');
let path = '/iss/engines/currency/markets/selt/boards/CETS/securities.json?securities=USD000UTSTOM,EUR_RUB__TOM';

let MongoClient = require('mongodb').MongoClient;
let url = 'mongodb://localhost:27017/roubleratebot';

let getNewRates = function (db) {
    let request = https.request({
        hostname: 'moex.com',
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
            let parsedData = JSON.parse(data);
            let index = parsedData.marketdata.columns.indexOf('LAST');
            // Евро в запросе всегда идёт первым
            let eurRate = parsedData.marketdata.data[0][index];
            let usdRate = parsedData.marketdata.data[1][index];
            let rates;

            if (eurRate && usdRate) {
                rates = [{title: 'EUR', rate: eurRate}, {title: 'USD', rate: usdRate}];
            } else {
                return;
            }

            // Сохраняем курс в базу
            rates.forEach(function (rate) {
                db.collection('rates').update({
                    title: rate.title
                }, {
                    title: rate.title,
                    rate: Number(rate.rate).toFixed(2)
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
                    if (user.lastSend) {
                        // Перебираем сохранённые курсы
                        Object.keys(user.lastSend).some(function (title) {
                            // Перебираем полученные курсы
                            return rates.some(function (rate) {
                                // Если совпала валюта
                                if (title === rate.title) {
                                    // Проверяем разницу и если она больше — посылаем значение
                                    if (Math.abs(user.lastSend[title] - rate.rate) > user.difference) {
                                        sender.sendRate(user.id, db);

                                        return true;
                                    }
                                }
                            });
                        });
                    } else {
                        sender.sendRate(user.id, db);
                    }
                });
            });
        });
    });

    request.on('error', function (err) {
        console.log('Problem with request: ' + err.message);
    });

    request.end();
};

MongoClient.connect(url, function (err, db) {
    if (err) { throw err; }

    getNewRates(db);

    setInterval(function () {
        getNewRates(db);
    }, 5000 * 60);
});
