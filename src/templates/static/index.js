'use strict';

const fs = require('fs');
const path = require('path');
const Template = require('../Template');

function load (file) {
    return fs.readFileSync(path.join(__dirname, file), {encoding: 'utf8'}).trim();
}

const templates = {
    test: {
        ping: new Template(load('test/ping.yml')),
        reboot: new Template(load('test/rebootTrigger.yml'))
    },
    special: {
        diagnosis: new Template(load('special/diagnosis.yml')),
        headerMulti: new Template(load('special/headerMulti.yml')),
        headerSimple: new Template(load('special/headerSimple.yml')),
        postRunCheckIn: new Template(load('special/postRunCheckIn.yml')),
        reboot: new Template(load('special/reboot.yml'))
    },
    vulnerabilities: {
        errata: new Template(load('vulnerabilities/errata.yml'))
    }
};

module.exports = Object.freeze(templates);
