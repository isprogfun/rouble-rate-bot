/**
 * Gets current rates every 5 minutes, stores them in db and finds users that wiil get a new rates
 */
import * as http from "http";
import * as https from "https";
import { MongoClient, MongoError, Db } from "mongodb";
import sender from "./common/sender";
import { Rate } from "./common/interfaces";

const path =
    "/iss/engines/currency/markets/selt/boards/CETS/securities.json?securities=USD000UTSTOM,EUR_RUB__TOM";
const getNewRates = (db: Db) => {
    const request = https.request(
        {
            hostname: "iss.moex.com",
            path,
            port: 443,
            method: "GET",
        },
        (res: http.IncomingMessage) => {
            let data = "";
            res.on("data", (chunk: {}) => {
                data += chunk;
            });
            res.on("end", () => {
                let parsedData;
                try {
                    parsedData = JSON.parse(data);
                } catch (error) {
                    console.log(
                        `${new Date().toISOString()}: Error parsing data, ${error}`
                    );
                }
                const index = parsedData.marketdata.columns.indexOf("LAST");
                // Euro is always first as in request
                const eurRate = parsedData.marketdata.data[0][index];
                const usdRate = parsedData.marketdata.data[1][index];
                let rates: Array<Rate>;
                if (eurRate && usdRate) {
                    console.log(`${new Date().toISOString()}: Got new rates`);
                    rates = [
                        {
                            title: "EUR",
                            rate: eurRate,
                        },
                        {
                            title: "USD",
                            rate: usdRate,
                        },
                    ];
                } else {
                    return;
                }

                // Save new rates to a db
                rates.forEach((rate) => {
                    db.collection("rates").update(
                        {
                            title: rate.title,
                        },
                        {
                            title: rate.title,
                            rate: Number(rate.rate).toFixed(2),
                        },
                        {
                            upsert: true,
                        }
                    );
                });

                // Find users that will get a new rate
                db.collection("users")
                    .find({ sendChanges: true })
                    .toArray((err, users) => {
                        if (err) {
                            throw err;
                        }
                        if (!users || !users.length) {
                            return;
                        }
                        // For every user
                        users.forEach((user) => {
                            if (!user.lastSend) {
                                sender.sendRate(user.id, "", db);
                                return;
                            }
                            // Cycle through saved rates
                            Object.keys(user.lastSend).some((title) =>
                                // Cycle through new rates
                                rates.some((rate) => {
                                    // If difference is more then threshold — send that rate
                                    if (
                                        title === rate.title &&
                                        Math.abs(
                                            user.lastSend[title] - rate.rate
                                        ) > user.difference
                                    ) {
                                        sender.sendRate(user.id, "", db);
                                        return true;
                                    }
                                    return false;
                                })
                            );
                        });
                    });
            });
        }
    );
    request.on("error", (err) => {
        console.log(
            `${new Date().toISOString()}: Error requesting data, ${err}`
        );
    });
    request.end();
};

MongoClient.connect(
    "mongodb://localhost:27017",
    {},
    (err: MongoError, client: MongoClient) => {
        if (err) {
            throw err;
        }
        const db = client.db("roubleratebot");

        getNewRates(db);
        setInterval(() => {
            getNewRates(db);
        }, 1000 * 60 * 5);
    }
);
