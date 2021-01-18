import { MongoClient, MongoError, Db } from "mongodb";
import { Handler } from "aws-lambda";
import sender from "./common/sender.js";

const handler: Handler = (event, context, callback) => {
    MongoClient.connect(
        "mongodb://localhost:27017",
        {},
        (err: MongoError, client: MongoClient) => {
            if (err) {
                throw err;
            }

            const database = client.db("roubleratebot");
            console.log(`${new Date().toISOString()}: Connected to db`);

            try {
                const update = JSON.parse(event.body);

                sender.handleMessage(database, update);
            } catch (error) {
                console.log(
                    `${new Date().toISOString()}: Error parsing data, ${error}`
                );

                return callback(null, {
                    statusCode: 400,
                });
            }
        }
    );

    return callback(null, {
        statusCode: 200,
        body: "Pong",
    });
};

exports.handler = handler;
