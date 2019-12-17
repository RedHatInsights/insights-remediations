'use strict';

const _ = require('lodash');
const Connector = require('../Connector');

const SOURCES = {
    '722ec903-f4b5-4b1f-9c2f-23fc7b0ba390': {
        created_at: '2019-12-13T11:47:00Z',
        id: '123',
        name: 'Satellite 1',
        source_ref: '722ec903-f4b5-4b1f-9c2f-23fc7b0ba390',
        source_type_id: '9',
        uid: '49cd4278-3be8-4862-944f-17187c3b568e',
        updated_at: '2019-12-13T11:47:00Z',
        tenant: '6089719',
        endpoints: [{
            created_at: '2019-12-13T11:47:01Z',
            default: true,
            id: '805',
            receptor_node: '098765',
            role: 'sattelite',
            source_id: '123',
            updated_at: '2019-12-13T11:47:01Z',
            tenant: '6089719'
        }]
    },
    '409dd231-6297-43a6-a726-5ce56923d624': {
        created_at: '2019-12-13T11:47:00Z',
        id: '124',
        name: 'We will be adding receptor',
        source_ref: '409dd231-6297-43a6-a726-5ce56923d624',
        source_type_id: '9',
        uid: '49cd4278-3be8-4862-944f-17187c3b568e',
        updated_at: '2019-12-13T11:47:00Z',
        tenant: '6089719',
        endpoints: [{
            created_at: '2019-12-13T11:47:01Z',
            default: true,
            id: '806',
            receptor_node: '098764',
            role: 'sattelite',
            source_id: '124',
            updated_at: '2019-12-13T11:47:01Z',
            tenant: '6089719'
        }]
    }
};

module.exports = new class extends Connector {
    constructor () {
        super(module);
    }

    async findSources () {
        throw new Error('unsupported');
    }

    async getEndoints () {
        throw new Error('unsupported');
    }

    async getSourceInfo (ids) {
        return _(ids)
        .keyBy()
        .mapValues(id => _.get(SOURCES, id, null));
    }

    async ping () {
        await this.findSources('test');
    }
}();
