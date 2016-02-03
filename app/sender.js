'use strict';

let https = require('https');
let querystring = require('querystring');
let config = require(__dirname + '/config.json');
let path = '/bot' + config.token + '/sendMessage?';
let options = {
    hostname: 'api.telegram.org',
    port: '443',
    method: 'POST'
};

module.exports = {
    /**
     * Если нам присылают конкретные команды — мы сразу отправляем конкретные ответы
     * Иначе вызываем функцию определения диалога
     */
    handleMessage: function (req, data) {
        let messageText = data.message.text;
        let chatId = data.message.chat.id;

        console.log('Got request at: ' + new Date() + '\n', data);

        // Сохраняем последнее сообщение пользователя для обработки настроек
        req.db.collection('users').findOneAndUpdate({ id: chatId }, {$set: {lastMessage: messageText}});

        // Проверяем стандартные команды
        if (messageText === '/start') {
            let text = 'Бот обновляет курсы доллара и евро каждую минуту.';
            text += 'Вы можете получить текущий биржевой курс, а также настроить оповещения по изменению курса.';

            this.sendMessage(chatId, text);
        } else if (messageText === '/settings') {
            this.handleSettings(chatId, req.db);
        } else if (messageText === '/get' || messageText === '💵') {
            this.sendRate(chatId, req.db);
        } else {
            // Команды не найдены — поиск сообщений для настроек
            this.handleNoCommand(chatId, messageText, req.db);
        }
    },

    sendMessage: function (chatId, text, replyMarkup) {
        replyMarkup = replyMarkup || JSON.stringify({
            keyboard: [['💵']],
            resize_keyboard: true
        });

        options.path = path + querystring.stringify({
            chat_id: chatId,
            text: text,
            reply_markup: replyMarkup,
            parse_mode: 'Markdown'
        });

        request = https.request (options, function (res) {
            res.on('data', function (resData) {
                console.log('Got answer at: ' + new Date() + '\n', JSON.parse(resData.toString()));
            });
        });

        request.on('error', function (e) {
            console.log('Problem with request at: ' + new Date() + '\n', e.message);
        });

        request.end();
    },

    /**
     * Выводим текущие настройки и клавиатуру с кнопками, ведущими ко всем настройкам в отдельности
     */
    handleSettings: function (chatId, db) {
        var that = this;

        db.collection('users').find({id: chatId}).toArray(function (err, users) {
            if (err) { throw err; }

            let notifications = false;
            let sendChanges = false;
            let replyMarkup = JSON.stringify({
                keyboard: [['Настроить оповещения'], ['Настроить разницу курса']],
                resize_keyboard: true
            });
            let text = 'Текущие настройки:\n' + 'Оповещения об изменении курса: ';

            // TODO: убрать временно нотификации по времени
            if (users && users.length) {
                notifications = users[0].notifications;
                sendChanges = users[0].sendChanges;
            } else {
                db.collection('users').insertOne({
                    id: chatId,
                    notifications: notifications,
                    sendChanges: sendChanges
                });
            }

            if (sendChanges) {
                text += '*Включены* \n';
                text += 'Разница курса для оповещения: *1 руб.*';
            } else {
                text += '*Выключены*';
            }

            that.sendMessage(chatId, text, replyMarkup);
        });
    },

    /**
     * Разбираемся с просто текстом, прислыанным пользователем (возможно это настройки)
     */
    handleNoCommand: function(chatId, messageText, db) {
        // TODO
    },

    /**
     * Отправляем курс валют
     */
    sendRate: function (chatId, db) {
        let that = this;
        let text,
        let lastSend = {};

        db.collection('rates').find().toArray(function (err, collection) {
            if (err) { throw err; }

            text = collection.map(function (rate) {
                let result = (Math.round(rate.rate * 100) / 100).toString();

                if (result.length === 4) {
                    result = result + '0';
                }

                lastSend[rate.title] = rate.rate;

                return rate.title + ': ' + result + ' руб';
            }).join('\n');

            // Пользователю сохраняем последние отправленные курсы
            db.collection('users').find({id: chatId}).toArray(function (err, users) {
                if (err) { throw err; }

                if (users && users.length) {
                    db.collection('users').update({ id: chatId }, { $set: {lastSend: lastSend} });
                }
            });

            that.sendMessage(chatId, text);
        });
    }
};
