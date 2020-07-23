'use strict';

const _ = require('lodash');
const ErratumPlay = require('./plays/ErratumPlay');
const AggregatedErratumPlay = require('./plays/AggregatedErrataPlay');

exports.process = function (plays) {
    const erratumPlaysByType = _(plays)
    .filter(play => play instanceof ErratumPlay)
    .partition(play => play.issueType === 'cve')
    .value();

    const mergedPlays = _.assign(..._.map(erratumPlaysByType, plays =>
        _(plays)
        .groupBy(play => play.hosts.join())
        .pickBy(plays => plays.length > 1)
        .mapValues(plays => new AggregatedErratumPlay(plays))
        .mapKeys(play => play.plays[0].id.full)
        .value()
    ));

    const toReplace = _(mergedPlays).values().flatMap(merged => merged.plays).keyBy(play => play.id.full).value();

    return plays.map(play => {
        if (mergedPlays.hasOwnProperty(play.id.full)) {
            return mergedPlays[play.id.full];
        }

        return play;
    }).filter(play => !(play instanceof ErratumPlay) || !toReplace.hasOwnProperty(play.id.full));
};
