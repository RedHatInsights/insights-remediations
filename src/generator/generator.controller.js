'use strict';

const _ = require('lodash');
const P = require('bluebird');

const errors = require('../errors');
const inventory = require('../external/inventory');
const templates = require('./templates');
const Play = require('./Play');
const format = require('./format');

const RESOLVERS = [
    require('./resolvers/ContentServerResolver'),
    require('./resolvers/ErrataResolver'),
    require('./resolvers/SSGResolver'),
    require('./resolvers/TestResolver')
].reverse();

exports.generate = errors.async(async function (req, res) {
    const input = { ...req.swagger.params.body.value };

    await resolveSystems(input.issues);
    await resolveTemplates(input.issues);

    disambiguateTemplates(input.issues);
    validateTemplates(input.issues);

    const plays = input.issues.map(({id, template, hosts}) => new Play(id, template, hosts));

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

async function resolveTemplates (issues) {
    const ids = _.map(issues, 'id');

    const responses = await P.all(P.map(RESOLVERS, handler => handler.resolveTemplates(ids)));
    const templates = _.assign({}, ...responses);

    issues.forEach(issue => issue.templates = templates[issue.id] || []);
}

function disambiguateTemplates (issues) {
    issues.forEach(issue => {
        if (!issue.templates || !issue.templates.length) {
            return;
        }

        if (issue.templates.length === 1) {
            issue.template = issue.templates[0];
            return;
        }

        issue.template = issue.templates[0];

        if (issue.resolution) {
            const found = _.find(issue.templates, {resolutionType: issue.resolution});

            if (found) {
                issue.template = found;
                return;
            }

            throw new errors.BadRequest('UNKNOWN_RESOLUTION',
                `Issue "${issue.id}" does not have Ansible resolution "${issue.resolution}"`);
        }

        const fix = _.find(issue.templates, {resolutionType: 'fix'});
        if (fix) {
            return [fix];
        }

        return [_.sortBy(issue.templates, 'resolutionType')[0]];
    });
}

function validateTemplates (issues) {
    issues.forEach(issue => {
        if (!issue.template) {
            throw new errors.BadRequest('UNSUPPORTED_ISSUE', `Issue "${issue.id}" does not have Ansible support`);
        }
    });
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
