var https = require('https'),
    querystring = require('querystring'),

    config = require('./config.json'),
    path = '/bot' + config.token + '/sendMessage?',
    options = {
        hostname: 'api.telegram.org',
        port: '443',
        method: 'POST'
    };

module.exports = function(data) {
    var request;

    console.log('Got request: ');
    console.log(data)

    options.path = path + querystring.stringify({
        'chat_id': data.message.chat.id,
        text: Math.round(Math.random() * 60) + '₽'
    });

    request = https.request(options, function(res) {
        res.on('data', function(resData) {
            console.log('Got answer');
            console.log(JSON.parse(resData.toString()));
        });
    });

    request.on('error', function(e) {
        console.log('Problem with request: ' + e.message);
    });

    request.end();
}
