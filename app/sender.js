const https = require('https');

const querystring = require('querystring');

const config = require('./config.json');

const path = `/bot${config.token}/sendMessage?`;
const options = {
    hostname: 'api.telegram.org',
    port: '443',
    method: 'POST',
};

module.exports = {
    /**
     * Если нам присылают конкретные команды — мы сразу отправляем конкретные ответы
     * Иначе вызываем функцию определения диалога
     */
    handleMessage(req, db, data) {
        const that = this;
        const messageText = data.message.text;
        const chatId = data.message.chat.id;

        console.log(`${(new Date()).toISOString()}: Got request\n`, data);

        if (messageText === '/start') {
            const text =
                'Бот обновляет курсы доллара и евро раз в 5 минут, используя данные ММВБ.\n' +
                'Список команд:\n' +
                '/get — Получить текущий биржевой курс\n' +
                '/settings — Настроить оповещения по изменению курса\n' +
                '/stop — Отписаться от оповещений';

            this.sendMessage(chatId, text);
        } else if (messageText === '/settings') {
            this.handleSettings(chatId, db, data);
        } else if (messageText === '/stop') {
            this.updateUser(chatId, db, { sendChanges: false });
            this.sendMessage(chatId, 'Вы отписались от оповещений');
        } else if (messageText === '/get' || messageText === '💵') {
            this.sendRate(chatId, db);
        } else {
            // Команды не найдены — поиск сообщений для настроек
            db.collection('users').findOne({ id: chatId }, (err, user) => {
                if (err) { throw err; }

                if (messageText === 'Выключить оповещения') {
                    that.updateUser(chatId, db, { sendChanges: false });
                    that.handleSettings(chatId, db);
                } else if (messageText === 'Включить оповещения') {
                    that.updateUser(chatId, db, { sendChanges: true });
                    that.handleSettings(chatId, db);
                } else if (messageText === 'Настроить разницу курса') {
                    const text = 'Введите новое значение разницы курса (от 0.01 до 10)';

                    that.updateUser(chatId, db, { lastMessage: messageText });
                    that.sendMessage(chatId, text, JSON.stringify({
                        keyboard: [['Выйти']],
                        resize_keyboard: true,
                    }));
                } else if (user.lastMessage === 'Настроить разницу курса' && messageText === 'Выйти') {
                    that.updateUser(chatId, db, { lastMessage: '' });
                    that.handleSettings(chatId, db);
                } else if (user.lastMessage === 'Настроить разницу курса') {
                    const difference = parseFloat(messageText);

                    if (difference && difference >= 0.01 && difference <= 10) {
                        that.updateUser(chatId, db, {
                            difference,
                            lastMessage: '',
                        });
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
    handleSettings(chatId, db, data) {
        const that = this;

        db.collection('users').findOne({ id: chatId }, (err, user) => {
            if (err) { throw err; }

            const sendChanges = (user && user.sendChanges) || false;
            const replyMarkup = { resize_keyboard: true };
            let text = 'Текущие настройки:\nОповещения об изменении курса: ';

            if (!user) {
                db.collection('users').insertOne({
                    id: chatId,
                    name: `${data.message.chat.first_name} ${data.message.chat.last_name || ''}`,
                    sendChanges,
                    difference: 1,
                });
            }

            if (sendChanges) {
                const difference = user.difference || 1;

                text += `*Включены*\nРазница курса для оповещения: *${difference} руб.*`;
                replyMarkup.keyboard = [
                    ['Выключить оповещения'],
                    ['Настроить разницу курса'],
                    ['Выйти'],
                ];
            } else {
                text += '*Выключены*';
                replyMarkup.keyboard = [
                    ['Включить оповещения'],
                    ['Выйти'],
                ];
            }

            that.sendMessage(chatId, text, JSON.stringify(replyMarkup));
        });
    },

    /**
     * Отправка стандартного сообщения
     */
    sendMessage(chatId, text, _replyMarkup) {
        const replyMarkup = _replyMarkup || JSON.stringify({
            keyboard: [['💵']],
            resize_keyboard: true,
        });

        options.path = path + querystring.stringify({
            chat_id: chatId,
            text,
            reply_markup: replyMarkup,
            parse_mode: 'Markdown',
        });

        const request = https.request(options, (res) => {
            res.on('data', (resData) => {
                console.log(`${(new Date()).toISOString()}: Got answer\n`, JSON.parse(resData.toString()));
            });
        });

        request.on('error', (err) => {
            console.log(`${(new Date()).toISOString()}: Problem with request\n`, err);
        });

        request.end();
    },

    /**
     * Отправляем курс валют
     */
    sendRate(chatId, db) {
        const that = this;

        db.collection('rates').find().toArray((err, collection) => {
            if (err) { throw err; }

            db.collection('users').findOne({ id: chatId }, (err, user) => {
                if (err) { throw err; }

                const lastSend = (user && user.lastSend) || {};

                // Сначала доллар
                collection.sort((rate) => {
                    if (rate.title === 'USD') {
                        return -1;
                    }

                    return 1;
                });

                const text = collection.map((rate) => {
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
                that.updateUser(chatId, db, { lastSend });
                that.sendMessage(chatId, text);
            });
        });
    },

    /**
     * Обновление настроек у пользователя
     */
    updateUser(chatId, db, data) {
        const that = this;

        if (data && Object.keys(data).length) {
            db.collection('users').findOneAndUpdate({
                id: chatId,
            }, {
                $set: data,
            }, (err) => {
                if (err) { throw err; }

                if (typeof data.sendChanges === 'boolean') {
                    that.notifyAdmin(db, data.sendChanges);
                }
            });
        }
    },

    /**
     * Отправить админу информацию о подключении/отключении от оповещений
     * и кол-во подключенных пользователей
     */
    notifyAdmin(db, sendChanges) {
        const that = this;
        let text = sendChanges ? '+1' : '-1';

        db.collection('users').find({
            sendChanges: true,
        }).toArray((err, collection) => {
            if (err) { throw err; }

            text = `Кол-во оповещаемых: ${text} (${collection && collection.length})`;

            that.sendMessage(config.adminId, text);
        });
    },
};
