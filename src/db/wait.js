'use strict';

// This module implements a simple utility that waits for the db connection to become available
const config = require('../config').db;
const pg = require('pg');

const RETRIES = 36;
const DELAY = 5000;
const SUCCESS = 0;
const FAILURE = -1;

const pg_config = {
    user: config.username,
    password: config.password,
    host: config.host,
    port: config.port,
    database: config.database
};

function wait (retries) {
    if (retries > 0) {
        const client = new pg.Client(pg_config);

        console.log(`Connecting to DB: ${pg_config.database}, HOST: ${pg_config.host}:${pg_config.port}, USER: ${pg_config.user}...`);
        client.connect()
        .then(() => {
            client.query("SELECT 'DB is alive!' AS result;")
            .then((res) => {
                console.log(`${JSON.stringify(res?.rows)}`);
            })
            .then(() => {
                client.end()
                // we connected - return success!
                .then(() => {process.exit(SUCCESS);});
            });
        })

        .catch((error) => {
            // retry connection...
            setTimeout(() => {wait(retries - 1);}, DELAY);
        });
    }

    else {
        // failed to connect!
        process.exit(FAILURE);
    }
}

module.exports = { wait };

if (require.main === module) {
    wait(RETRIES);
}