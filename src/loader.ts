/**
 * Gets current rates every 5 minutes, stores them in db and finds users that wiil get a new rates
 */
interface Rate {
    title: string;
    rate: number;
}

import * as http from 'http';
import * as https from 'https';
import { MongoClient, MongoError, Db } from 'mongodb';
import sender from './sender';
var config = require('../config.json');
var path = '/iss/engines/currency/markets/selt/boards/CETS/securities.json?securities=USD000UTSTOM,EUR_RUB__TOM';
var getNewRates = function (db: Db) {
    var request = https.request({
        hostname: 'iss.moex.com',
        path: path,
        port: 443,
        method: 'GET'
    }, function (res: http.IncomingMessage) {
        var data = '';
        res.on('data', function (chunk: {}) {
            data += chunk;
        });
        res.on('end', function () {
            var parsedData;
            try {
                parsedData = JSON.parse(data);
            }
            catch (error) {
                console.log((new Date()).toISOString() + ": Error parsing data, " + error);
            }
            var index = parsedData.marketdata.columns.indexOf('LAST');
            // Euro is always first as in request
            var eurRate = parsedData.marketdata.data[0][index];
            var usdRate = parsedData.marketdata.data[1][index];
            var rates: Array<Rate>;
            if (eurRate && usdRate) {
                console.log((new Date()).toISOString() + ": Got new rates");
                rates = [
                    {
                        title: 'EUR',
                        rate: eurRate
                    },
                    {
                        title: 'USD',
                        rate: usdRate
                    },
                ];
            }
            else {
                return;
            }

            // Save new rates to a db
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

            // Find users that will get a new rate
            db.collection('users').find({ sendChanges: true }).toArray(function (err, users) {
                if (err) {
                    throw err;
                }
                if (!users || !users.length) {
                    return;
                }
                // For every user
                users.forEach(function (user) {
                    if (!user.lastSend) {
                        sender.sendRate(user.id, db);
                        return;
                    }
                    // Cycle through saved rates
                    Object.keys(user.lastSend).some(function (title) { return (
                        // Cycle through new rates
                        rates.some(function (rate) {
                            // If difference is more then threshold — send that rate
                            if (title === rate.title &&
                                Math.abs(user.lastSend[title] - rate.rate) > user.difference) {
                                sender.sendRate(user.id, db);
                                return true;
                            }
                            return false;
                        }));
                    });
                });
            });
        });
    });
    request.on('error', function (err) {
        console.log((new Date()).toISOString() + ": Error requesting data, " + err);
    });
    request.end();
};

MongoClient.connect('mongodb://localhost:27017', {}, (err: MongoError, client: MongoClient) => {
    if (err) {
        throw err;
    }
    const db = client.db('roubleratebot')

    getNewRates(db);
    setInterval(function () {
        getNewRates(db);
    }, 1000 * 60 * 5);
});
