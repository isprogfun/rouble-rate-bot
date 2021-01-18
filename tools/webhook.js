const https = require("https");

const config = require("../config.json");

const options = {
    host: "api.telegram.org",
    port: 443,
    // Убрать хук
    path: `/bot${config.token}/setWebhook?url=`,
    // path: `/bot${config.token}/setWebhook?url=${config.url}`,
    method: "GET",
};

const request = https.request(options, (res) => {
    res.on("end", (data) => {
        console.log(`${new Date()}: Got answer`);
        console.log(data);
    });
});

request.on("error", (error) => {
    console.error(`${new Date()}: Request error`);
    console.error(error);
});

request.end();
