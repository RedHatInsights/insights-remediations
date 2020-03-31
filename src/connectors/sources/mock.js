'use strict';

const _ = require('lodash');
const Connector = require('../Connector');

const SOURCES = {
    '722ec903-f4b5-4b1f-9c2f-23fc7b0ba390': {
        created_at: '2019-12-13T11:47:00Z',
        id: '123',
        name: 'Satellite 1 (connected)',
        source_ref: '722ec903-f4b5-4b1f-9c2f-23fc7b0ba390',
        source_type_id: '9',
        uid: '49cd4278-3be8-4862-944f-17187c3b568e',
        updated_at: '2019-12-13T11:47:00Z',
        endpoints: [{
            created_at: '2019-12-13T11:47:01Z',
            default: true,
            id: '805',
            receptor_node: '098765',
            role: 'sattelite',
            source_id: '123',
            updated_at: '2019-12-13T11:47:01Z'
        }]
    },
    '409dd231-6297-43a6-a726-5ce56923d624': {
        created_at: '2019-12-13T11:47:00Z',
        id: '124',
        name: 'Satellite 2 (disconnected)',
        source_ref: '409dd231-6297-43a6-a726-5ce56923d624',
        source_type_id: '9',
        uid: '49cd4278-3be8-4862-944f-17187c3b568e',
        updated_at: '2019-12-13T11:47:00Z',
        endpoints: [{
            created_at: '2019-12-13T11:47:01Z',
            default: true,
            id: '806',
            receptor_node: '098764',
            role: 'sattelite',
            source_id: '124',
            updated_at: '2019-12-13T11:47:01Z'
        }]
    },
    '72f44b25-64a7-4ee7-a94e-3beed9393972': {
        created_at: '2019-12-13T11:47:00Z',
        id: '125',
        name: 'Satellite 3 (no receptor configured)',
        source_ref: '72f44b25-64a7-4ee7-a94e-3beed9393972',
        source_type_id: '9',
        uid: '49cd4278-3be8-4862-944f-17187c3b568e',
        updated_at: '2019-12-13T11:47:00Z',
        endpoints: []
    },
    '63142926-46a5-498b-9614-01f2f66fd40b': {
        created_at: '2019-12-13T11:47:00Z',
        id: '126',
        name: 'Satellite 4 (connected)',
        source_ref: '63142926-46a5-498b-9614-01f2f66fd40b',
        source_type_id: '9',
        uid: '49cd4278-3be8-4862-944f-17187c3b568e',
        updated_at: '2019-12-13T11:47:00Z',
        endpoints: [{
            created_at: '2019-12-13T11:47:01Z',
            default: true,
            id: '808',
            receptor_node: '098768',
            role: 'sattelite',
            source_id: '126',
            updated_at: '2019-12-13T11:47:01Z'
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
        .mapValues(id => _.get(SOURCES, id, null))
        .value();
    }

    async ping () {
        await this.findSources('test');
    }
}();
