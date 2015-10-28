var https = require('https');
var token = require('./app/config.json').token;
var options = {
    host: 'api.telegram.org',
    port: 443,
    // path: '/bot' + token + '/setWebhook?url=',
    path: '/bot' + token + '/setWebhook?url=https://isprogfun.ru/' + token,
    method: 'GET'
};
var request;

request = https.request(options, function (res) {
    res.on('end', function (data) {
        console.log('Got answer: ');
        console.log(data);
    });
});

request.on('error', function (e) {
    console.log('Problem with request: ' + e.message);
});

request.end();
