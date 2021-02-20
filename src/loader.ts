/**
 * Gets current rates every 5 minutes, stores them in db and finds users that wiil get a new rates
 */
import * as http from "http";
import * as https from "https";
import { Db } from "mongodb";
import { Handler } from "aws-lambda";
import sender from "./common/sender";
import { Rate } from "./common/interfaces";
import connectToDatabase from './common/database';

const { MONGODB_URI } = process.env;

const path =
    "/iss/engines/currency/markets/selt/boards/CETS/securities.json?securities=USD000UTSTOM,EUR_RUB__TOM";

function getNewRates(db: Db) {
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
                    db.collection("rates").updateOne(
                        {
                            title: rate.title,
                        },
                        {
                            $set: {
                                title: rate.title,
                                rate: Number(rate.rate).toFixed(2),
                            }
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

const handler: Handler = (event, context, callback) => {
    context.callbackWaitsForEmptyEventLoop = false;

    connectToDatabase(MONGODB_URI).then((db) => {
        try {
            getNewRates(db);
        } catch (error) {
            console.log("=> an error occurred: ", error);

            callback(error);
        }
    });
};

exports.handler = handler;
