'use strict';

const _ = require('lodash');
const P = require('bluebird');

const errors = require('../errors');
const inventory = require('../external/inventory');
const templates = require('./templates/static');
const Play = require('./Play');
const format = require('./format');
const identifiers = require('../util/identifiers');

const handlers = require('./handlers');

exports.generate = errors.async(async function (req, res) {
    const input = { ...req.swagger.params.body.value };

    await resolveSystems(input.issues);

    input.issues.forEach(issue => issue.id = identifiers.parse(issue.id));

    const plays = await P.map(input.issues, handlers.createPlay);

    addRebootPlay(plays);
    addPostRunCheckIn(plays);
    addDiagnosisPlay(plays);

    const playbook = format.render(plays);
    format.validate(playbook);
    return send(res, playbook);
});

async function resolveSystems (issues) {
    const systemIds = _(issues).flatMap('systems').uniq().value();
    const systems = await inventory.getSystemDetailsBatch(systemIds);

    issues.forEach(issue => issue.hosts = issue.systems.map(id => {
        return systems[id].display_name || systems[id].hostname || systems[id].id;
    }));
}

function addRebootPlay (plays) {
    if (!_.some(plays, 'template.needsReboot')) {
        return;
    }

    const hosts = _(plays).filter(play => play.template.needsReboot).flatMap('hosts').uniq().sort().value();
    plays.push(new Play('special:reboot', templates.special.reboot, hosts));
}

function addPostRunCheckIn (plays) {
    const hosts = _(plays).flatMap('hosts').uniq().sort().value();
    plays.push(new Play('special:post-run-check-in', templates.special.postRunCheckIn, hosts));
}

function addDiagnosisPlay (plays) {
    const diagnosisPlays = plays.filter(play => play.template.needsDiagnosis);

    if (!diagnosisPlays.length) {
        return;
    }

    const hosts = _(diagnosisPlays).flatMap('hosts').uniq().sort().value();
    plays.unshift(new Play('special:diagnosis', templates.special.diagnosis, hosts));
}

function send (res, playbook) {
    res.set({
        'Content-type': 'text/vnd.yaml'

        // TODO make optional
        //'Content-disposition': `attachment;filename="insights-playbook.yml"`
    });

    return res.send(playbook).end();
}
