import { MongoClient, MongoError, Db } from 'mongodb';
import * as https from 'https';

import { Update } from './interfaces';
import sender from './sender.js';
const config = require('../config.json');

let offset = 0;

function makeRequest(db: Db) {
    let offsetURL = '';

    if (offset > 0) {
        offsetURL = `&offset=${String(offset + 1)}`;
    }

    const request = https.request({
        hostname: 'api.telegram.org',
        path: `/bot${config.token}/getUpdates?timeout=60${offsetURL}`,
        port: 443,
        method: 'GET',
    }, (responce) => {
        let data = '';

        responce.on('data', (chunk) => {
            data += chunk;
        });
        responce.on('end', () => {
            let parsedData;

            try {
                parsedData = JSON.parse(data);
            } catch (error) {
                console.log(`${(new Date()).toISOString()}: Error parsing data, ${error}`);

                return;
            }

            if (!parsedData.ok) {
                console.log(`${(new Date()).toISOString()}: Error in the response, ${JSON.stringify(parsedData)}`);

                return;
            }

            if (parsedData.result.length === 0) {
                makeRequest(db);
            } else {
                parsedData.result.forEach((update: Update) => {
                    offset = update.update_id;
                    sender.handleMessage(db, update);
                });

                makeRequest(db);
            }
        });
    });
    request.on('error', (error) => {
        console.log(`${(new Date()).toISOString()}: Error requesting data, '${error}`);
    });
    request.end();
}

MongoClient.connect('mongodb://localhost:27017', {}, (err: MongoError, client: MongoClient) => {
    if (err) {
        throw err;
    }

    const db = client.db('roubleratebot');
    console.log((new Date()).toISOString() + ": Connected to db");

    makeRequest(db);
});
