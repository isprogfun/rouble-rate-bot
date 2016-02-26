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
        let that = this;
        let db = req.db;

        console.log('Got request at: ' + new Date() + '\n', data);

        if (messageText === '/start') {
            let text = `Бот обновляет курсы доллара и евро каждую минуту.

Список команд:
/get — Получить текущий биржевой курс
/settings — Настроить оповещения по изменению курса
/stop — Отписаться от оповещений`;

            this.sendMessage(chatId, text);
        } else if (messageText === '/settings') {
            this.handleSettings(chatId, db, data);
        } else if (messageText === '/stop') {
            this.updateUser(chatId, db, {sendChanges: false});
            this.sendMessage(chatId, 'Вы отписались от оповещений');
        } else if (messageText === '/get' || messageText === '💵') {
            this.sendRate(chatId, db);
        } else {
            // Команды не найдены — поиск сообщений для настроек
            db.collection('users').findOne({id: chatId}, function (err, user) {
                if (err) { throw err; }

                if (messageText === 'Выключить оповещения') {
                    that.updateUser(chatId, db, {sendChanges: false});
                    that.handleSettings(chatId, db);
                } else if (messageText == 'Включить оповещения') {
                    that.updateUser(chatId, db, {sendChanges: true});
                    that.handleSettings(chatId, db);
                } else if (messageText === 'Настроить разницу курса') {
                    let text = 'Введите новое значение разницы курса (от 0.01 до 10)';

                    that.updateUser(chatId, db, {lastMessage: messageText});
                    that.sendMessage(chatId, text, JSON.stringify({
                        keyboard: [['Выйти']],
                        resize_keyboard: true
                    }));
                } else if (user.lastMessage === 'Настроить разницу курса' && messageText === 'Выйти') {
                    that.updateUser(chatId, db, {lastMessage: ''});
                    that.handleSettings(chatId, db);
                } else if (user.lastMessage === 'Настроить разницу курса') {
                    let difference = parseFloat(messageText);

                    if (difference && difference >= 0.01 && difference <= 10) {
                        that.updateUser(chatId, db, {difference: difference, lastMessage: ''});
                        that.handleSettings(chatId, db);
                    }
                } else if (messageText === 'Выйти') {
                    that.sendMessage(chatId, 'Вы вышли из режима настроек');
                }
            });
        }
    },

    /**
     * Выводим текущие настройки и клавиатуру с кнопками,
     * ведущими ко всем настройкам в отдельности
     */
    handleSettings: function (chatId, db, data) {
        let that = this;

        db.collection('users').findOne({id: chatId}, function (err, user) {
            if (err) { throw err; }

            let sendChanges = (user && user.sendChanges) || false;
            let text = 'Текущие настройки:\nОповещения об изменении курса: ';
            let replyMarkup = {resize_keyboard: true};

            if (!user) {
                db.collection('users').insertOne({
                    id: chatId,
                    name: `${data.message.chat.first_name} ${data.message.chat.last_name || ''}`,
                    sendChanges: sendChanges,
                    difference: 1
                });
            }

            if (sendChanges) {
                let difference = user.difference || 1;

                text += `*Включены*\nРазница курса для оповещения: *${difference} руб.*`;
                replyMarkup.keyboard = [
                    ['Выключить оповещения'],
                    ['Настроить разницу курса'],
                    ['Выйти']
                ];
            } else {
                text += '*Выключены*';
                replyMarkup.keyboard = [
                    ['Включить оповещения'],
                    ['Выйти']
                ];
            }

            that.sendMessage(chatId, text, JSON.stringify(replyMarkup));
        });
    },

    /**
     * Отправка стандартного сообщения
     */
    sendMessage: function (chatId, text, replyMarkup) {
        let request;

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
     * Отправляем курс валют
     */
    sendRate: function (chatId, db) {
        let that = this;

        db.collection('rates').find().toArray(function (err, collection) {
            if (err) { throw err; }

            db.collection('users').findOne({id: chatId}, function (err, user) {
                if (err) { throw err; }

                let lastSend = user && user.lastSend || {};
                let text;

                // Сначала доллар
                collection.sort(function (rate) {
                    if (rate.title === 'USD') {
                        return -1;
                    } else {
                        return 1;
                    }
                });

                text = collection.map(function (rate) {
                    let result = `${rate.title}: ${rate.rate} руб`;
                    let difference;

                    if (lastSend && Object.keys(lastSend).length) {
                        difference = Number(rate.rate - lastSend[rate.title]).toFixed(2);
                    }

                    if (difference && difference > 0) {
                        result += ` _(+${difference} руб)_`;
                    } else if (difference && Number(difference) !== 0 && (Number(difference)).toString() !== 'NaN') {
                        result += ` _(${difference} руб)_`;
                    }

                    lastSend[rate.title] = rate.rate;

                    return result;
                }).join('\n');

                // Пользователю сохраняем последние отправленные курсы
                that.updateUser(chatId, db, {lastSend: lastSend});
                that.sendMessage(chatId, text);
            });
        });
    },

    /**
     * Обновление настроек у пользователя
     */
    updateUser: function (chatId, db, options) {
        let that = this;

        if (options && Object.keys(options).length) {
            db.collection('users').findOneAndUpdate({
                id: chatId
            }, {
                $set: options
            }, function (err) {
                if (err) { throw err; }

                if (typeof options.sendChanges === 'boolean') {
                    that.notifyAdmin(db, options.sendChanges);
                }
            });
        }
    },

    /**
     * Отправить админу информацию о подключении/отключении от оповещений
     * и кол-во подключенных пользователей
     */
    notifyAdmin: function (db, sendChanges) {
        let that = this;
        let text = sendChanges ? '+1' : '-1';

        db.collection('users').find({
            sendChanges: true
        }).toArray(function (err, collection) {
            if (err) { throw err; }

            text = `Кол-во оповещаемых: ${text} (${collection && collection.length})`;

            that.sendMessage(config.adminId, text);
        });
    }
};
