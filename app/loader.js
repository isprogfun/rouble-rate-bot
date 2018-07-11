"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const https = __importStar(require("https"));
const mongodb_1 = require("mongodb");
const sender_1 = __importDefault(require("./sender"));
var config = require('../config.json');
var path = '/iss/engines/currency/markets/selt/boards/CETS/securities.json?securities=USD000UTSTOM,EUR_RUB__TOM';
var getNewRates = function (db) {
    var request = https.request({
        hostname: 'iss.moex.com',
        path: path,
        port: 443,
        method: 'GET'
    }, function (res) {
        var data = '';
        res.on('data', function (chunk) {
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
            var rates;
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
                        sender_1.default.sendRate(user.id, db);
                        return;
                    }
                    // Cycle through saved rates
                    Object.keys(user.lastSend).some(function (title) {
                        return (
                        // Cycle through new rates
                        rates.some(function (rate) {
                            // If difference is more then threshold — send that rate
                            if (title === rate.title &&
                                Math.abs(user.lastSend[title] - rate.rate) > user.difference) {
                                sender_1.default.sendRate(user.id, db);
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
mongodb_1.MongoClient.connect('mongodb://localhost:27017', {}, (err, client) => {
    if (err) {
        throw err;
    }
    const db = client.db('roubleratebot');
    getNewRates(db);
    setInterval(function () {
        getNewRates(db);
    }, 1000 * 60 * 5);
});
