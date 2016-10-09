const https = require('https');

const token = require('../app/config.json').token;

const options = {
    host: 'api.telegram.org',
    port: 443,
    // Убрать хук
    // path: `/bot${token}/setWebhook?url=`,
    path: `/bot${token}/setWebhook?url=https://isprogfun.ru/${token}`,
    method: 'GET',
};

const request = https.request(options, (res) => {
    res.on('end', (data) => {
        console.log(`${new Date()}: Got answer`);
        console.log(data);
    });
});

request.on('error', (error) => {
    console.error(`${new Date()}: Request error`);
    console.error(error);
});

request.end();
