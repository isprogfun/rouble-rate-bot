module.exports = {
    apps: [
        {
            name: 'rouble-rate-bot-server',
            script: 'app/server.js',
            error_file: '/var/log/pm2/rouble-rate-bot/server-error.log',
            out_file: '/var/log/pm2/rouble-rate-bot/server-out.log',
            merge_logs: true,
            env_production: {
                NODE_ENV: 'production',
            },
        },
        {
            name: 'rouble-rate-bot-loader',
            script: 'app/loader.js',
            error_file: '/var/log/pm2/rouble-rate-bot/loader-error.log',
            out_file: '/var/log/pm2/rouble-rate-bot/loader-out.log',
            merge_logs: true,
            env_production: {
                NODE_ENV: 'production',
            },
        },
    ],
    deploy: {
        production: {
            user: 'isprogfun',
            host: '178.62.230.7',
            ref: 'origin/master',
            repo: 'git@github.com:isprogfun/rouble-rate-bot.git',
            path: '/srv/rouble-rate-bot',
            'pre-deploy-local': 'scp config.json isprogfun@178.62.230.7:/srv/rouble-rate-bot/source',
            'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
            'post-setup': 'cp stuff/rouble-rate-bot /etc/logrotate.d/rouble-rate-bot',
        },
    },
};