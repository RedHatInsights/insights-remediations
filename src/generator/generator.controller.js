'use strict';

const _ = require('lodash');
const P = require('bluebird');

const errors = require('../errors');
const inventory = require('../connectors/inventory');
const templates = require('../templates/static');
const SpecialPlay = require('./plays/SpecialPlay');
const format = require('./format');
const identifiers = require('../util/identifiers');
const erratumPlayAggregator = require('./erratumPlayAggregator');
const issueManager = require('../issues');

exports.playbookPipeline = async function (input, remediation = false) {
    await resolveSystems(input);
    input.issues.forEach(issue => issue.id = identifiers.parse(issue.id));
    let issues = await P.map(input.issues, issue => issueManager.getPlayFactory(issue.id).createPlay(issue));

    issues = erratumPlayAggregator.process(issues);
    issues = addRebootPlay(issues);
    issues = addPostRunCheckIn(issues);
    issues = addDiagnosisPlay(issues);

    const playbook = format.render(issues, remediation);
    format.validate(playbook);

    return playbook;
};

exports.generate = errors.async(async function (req, res) {
    const input = { ...req.swagger.params.body.value };
    const playbook = await exports.playbookPipeline(input);
    return exports.send(res, playbook);
});

async function resolveSystems (input) {
    const systemIds = _(input.issues).flatMap('systems').uniq().value();
    const systems = await inventory.getSystemDetailsBatch(systemIds);

    input.issues.forEach(issue => issue.hosts = issue.systems.map(id => {
        if (!systems.hasOwnProperty(id)) {
            throw errors.unknownSystem(id);
        }

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
    return [...plays, new SpecialPlay('special:reboot', hosts, templates.special.reboot)];
}

function addPostRunCheckIn (plays) {
    const hosts = _(plays).flatMap('hosts').uniq().sort().value();
    return [...plays, new SpecialPlay('special:post-run-check-in', hosts, templates.special.postRunCheckIn)];
}

function addDiagnosisPlay (plays) {
    const diagnosisPlays = plays.filter(play => play.needsDiagnosis());

    if (!diagnosisPlays.length) {
        return plays;
    }

    const hosts = _(diagnosisPlays).flatMap('hosts').uniq().sort().value();
    return [new SpecialPlay('special:diagnosis', hosts, templates.special.diagnosis), ...plays];
}

exports.send = function (res, playbook, attachment = false) {
    res.set('Content-type', 'text/vnd.yaml');

    if (attachment) {
        res.set('Content-disposition', `attachment;filename="${attachment}"`);
    }

    return res.send(playbook).end();
};
