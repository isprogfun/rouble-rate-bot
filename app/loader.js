/**
 * Запрашивает курс каждые 5 минут
 * Полученные данные сохраняет в базу, ищет пользователей, которым надо отправить новый курс
 */
const https = require('https');

const sender = require('./sender.js');

const config = require('./config.json');

const path = '/iss/engines/currency/markets/selt/boards/CETS/securities.json?securities=USD000UTSTOM,EUR_RUB__TOM';

const MongoClient = require('mongodb').MongoClient;

const getNewRates = (db) => {
    const request = https.request({
        hostname: 'iss.moex.com',
        path,
        port: 443,
        method: 'GET',
    }, (res) => {
        let data = '';

        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            let parsedData;

            try {
                parsedData = JSON.parse(data);
            } catch (error) {
                console.log(`${(new Date()).toISOString()}: Error parsing data, ${error}`);
            }

            const index = parsedData.marketdata.columns.indexOf('LAST');
            // Евро в запросе всегда идёт первым
            const eurRate = parsedData.marketdata.data[0][index];
            const usdRate = parsedData.marketdata.data[1][index];
            let rates;

            if (eurRate && usdRate) {
                console.log(`${(new Date()).toISOString()}: Got new rates`);

                rates = [
                    {
                        title: 'EUR',
                        rate: eurRate,
                    },
                    {
                        title: 'USD',
                        rate: usdRate,
                    },
                ];
            } else {
                return;
            }

            // Сохраняем курс в базу
            rates.forEach((rate) => {
                db.collection('rates').update({
                    title: rate.title,
                }, {
                    title: rate.title,
                    rate: Number(rate.rate).toFixed(2),
                }, {
                    upsert: true,
                });
            });

            /**
             * Перебираем юзеров, которые следят за изменениями
             * проверяем для каждой записи, надо ли отправить им новый курс
             */
            db.collection('users').find({ sendChanges: true }).toArray((err, users) => {
                if (err) { throw err; }

                if (!users || !users.length) { return; }

                // Для каждого юзера
                users.forEach((user) => {
                    if (!user.lastSend) {
                        sender.sendRate(user.id, db);

                        return;
                    }

                    // Перебираем сохранённые курсы
                    Object.keys(user.lastSend).some(title => (
                        // Перебираем полученные курсы
                        rates.some((rate) => {
                            // Если совпала валюта и разница больше — посылаем значение
                            if (
                                title === rate.title &&
                                Math.abs(user.lastSend[title] - rate.rate) > user.difference
                            ) {
                                sender.sendRate(user.id, db);

                                return true;
                            }

                            return false;
                        })
                    ));
                });
            });
        });
    });

    request.on('error', (err) => {
        console.log(`${(new Date()).toISOString()}: Error requesting data, ${err}`);
    });

    request.end();
};

MongoClient.connect(config.db, (err, db) => {
    if (err) { throw err; }

    getNewRates(db);

    setInterval(() => {
        getNewRates(db);
    }, 1000 * 60 * 5);
});
