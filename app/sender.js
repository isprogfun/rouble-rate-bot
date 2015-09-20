var https = require('https');
var querystring = require('querystring');

var config = require('./config.json');
var path = '/bot' + config.token + '/sendMessage?';
var options = {
    hostname: 'api.telegram.org',
    port: '443',
    method: 'POST'
};

function sendMessage(data, text, replyMarkup) {
    replyMarkup = replyMarkup || JSON.stringify({
        keyboard: [['💵']],
        resize_keyboard: true
    });

    options.path = path + querystring.stringify({
        chat_id: data.message.chat.id,
        text: text,
        reply_markup: replyMarkup
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
}

function handleSettings(req, data, text) {
    req.db.collection('users').find({id: data.message.from.id}).toArray(function (err, users) {
        if (err) {
            throw err;
        }

        var user;
        var notifications;

        if (users && users.length) {
            notifications = users[0].notifications;
        } else {
            notifications = false;

            req.db.collection('users').insertOne({
                id: data.message.from.id,
                notifications: notifications
            });
        }

        if (!notifications) {
            text = 'Включить получение ежедневных утренних уведомлений о текущем курсе';
            replyMarkup = JSON.stringify({
                keyboard: [['Включить']],
                resize_keyboard: true
            });
        } else {
            text = 'Выключить получение ежедневных утренних уведомлений о текущем курсе';
            replyMarkup = JSON.stringify({
                keyboard: [['Выключить']],
                resize_keyboard: true
            });
        }

        sendMessage(data, text, replyMarkup);
    });
}

function handleMain(req, data, text) {
    req.db.collection('rates').find().toArray(function (err, collection) {
        if (err) {
            throw err;
        }

        text = collection.map(function (rate) {
            var result = (Math.round(rate.rate * 100) / 100).toString();

            if (result.length === 4) {
                result = result + '0';
            }

            return rate.title + ': ' + result + ' руб';
        }).join('\n');

        sendMessage(data, text);
    });
}

module.exports = function (data, req) {
    var request;
    var text;

    console.log('Got request: ');
    console.log(data);

    switch (data.message.text) {
        case '/start':
            text = 'Привет. Я обновляю курсы доллара и евро каждую минуту. ' +
                'Отправь мне пачку денег или команду /get и я пришлю тебе всё, что знаю.';
            sendMessage(data, text);
            break;

        case '/settings':
            handleSettings(req, data, text);
            break;

        case 'Включить':
            req.db.collection('users').findOneAndUpdate({
                id: data.message.from.id
            }, {$set: {notifications: true}});
            sendMessage(data, 'Обновления включены');
            break;

        case 'Выключить':
            req.db.collection('users').findOneAndUpdate({
                id: data.message.from.id
            }, {$set: {notifications: false}});
            sendMessage(data, 'Обновления выключены');
            break;

        case '/get':
        case '💵':
            handleMain(req, data, text);
            break;

        default:
            return;
            break;
    }
};
