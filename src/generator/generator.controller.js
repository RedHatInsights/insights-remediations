'use strict';

const _ = require('lodash');
const P = require('bluebird');

const errors = require('../errors');
const inventory = require('../connectors/inventory');
const templates = require('../templates/static');
const SpecialPlay = require('./SpecialPlay');
const format = require('./format');
const identifiers = require('../util/identifiers');
const erratumPlayAggregator = require('./erratumPlayAggregator');
const {composeAsync} = require('../util/fn');

const handlers = require('./handlers');

const playbookPipeline = composeAsync(
    resolveSystems,
    input => {
        input.issues.forEach(issue => issue.id = identifiers.parse(issue.id));
        return input;
    },
    ({issues}) => P.map(issues, handlers.createPlay),
    erratumPlayAggregator.process,
    addRebootPlay,
    addPostRunCheckIn,
    addDiagnosisPlay,
    format.render,
    format.validate
);

exports.generate = errors.async(async function (req, res) {
    const input = { ...req.swagger.params.body.value };
    const playbook = await playbookPipeline(input);
    return send(res, playbook);
});

async function resolveSystems (input) {
    const systemIds = _(input.issues).flatMap('systems').uniq().value();
    const systems = await inventory.getSystemDetailsBatch(systemIds);

    input.issues.forEach(issue => issue.hosts = issue.systems.map(id => {
        return systems[id].display_name || systems[id].hostname || systems[id].id;
    }));

    return input;
}

function addRebootPlay (plays) {
    const rebootRequiringPlays = _.filter(plays, play => play.needsReboot());
    if (rebootRequiringPlays.length === 0) {
        return plays;
    }

    const hosts = _(rebootRequiringPlays).flatMap('hosts').uniq().sort().value();
    plays.push(new SpecialPlay('special:reboot', hosts, templates.special.reboot));
    return plays;
}

function addPostRunCheckIn (plays) {
    const hosts = _(plays).flatMap('hosts').uniq().sort().value();
    plays.push(new SpecialPlay('special:post-run-check-in', hosts, templates.special.postRunCheckIn));
    return plays;
}

function addDiagnosisPlay (plays) {
    const diagnosisPlays = plays.filter(play => play.needsDiagnosis());

    if (!diagnosisPlays.length) {
        return plays;
    }

    const hosts = _(diagnosisPlays).flatMap('hosts').uniq().sort().value();
    plays.unshift(new SpecialPlay('special:diagnosis', hosts, templates.special.diagnosis));
    return plays;
}

function send (res, playbook) {
    res.set({
        'Content-type': 'text/vnd.yaml'

        // TODO make optional
        //'Content-disposition': `attachment;filename="insights-playbook.yml"`
    });

    return res.send(playbook).end();
}
