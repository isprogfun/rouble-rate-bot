import { Handler } from "aws-lambda";
import sender from "./common/sender";
import connectToDatabase from './common/database';

const { MONGODB_URI } = process.env;

const handler: Handler = (event, context, callback) => {
    context.callbackWaitsForEmptyEventLoop = false;

    connectToDatabase(MONGODB_URI).then((db) => {
        try {
            sender.handleMessage(db, JSON.parse(event.body), () => {
                callback(null, {
                    statusCode: 200
                });
            });
        } catch (error) {
            console.log("=> an error occurred: ", error);

            callback(error);
        }
    });
};

exports.handler = handler;
