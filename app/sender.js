var https = require('https');
var querystring = require('querystring');
var fs = require('fs');
var config = require('./config.json');
var path = '/bot' + config.token + '/sendMessage?';
var options = {
    hostname: 'api.telegram.org',
    port: '443',
    method: 'POST'
};

module.exports = function (data) {
    var request;

    console.log('Got request: ');
    console.log(data);

    options.path = path + querystring.stringify({
        chat_id: data.message.chat.id,
        text: JSON.parse(fs.readFileSync(__dirname + '/../rates.json')).query.results.rate.map(function (rate) {
            return rate.Name + ': ' + rate.Rate + '₽';
        }).join('\n')
    });

    request = https.request (options, function (res) {
        res.on('data', function (resData) {
            console.log('Got answer');
            console.log(JSON.parse(resData.toString()));
        });
    });

    request.on('error', function (e) {
        console.log('Problem with request: ' + e.message);
    });

    request.end();
};
