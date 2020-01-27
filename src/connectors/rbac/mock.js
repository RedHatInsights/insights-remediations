'use strict';

const Connector = require('../Connector');

const ACCESS = {
    meta: {
        count: 1,
        limit: 10,
        offset: 0
    },
    links: {
        first: '/api/rbac/v1/access/?application=remediations&limit=10&offset=0',
        next: null,
        previous: null,
        last: '/api/rbac/v1/access/?application=remediations&limit=10&offset=0'
    },
    data: [
        {
            permission: 'remediations:*:*',
            resourceDefinitions: []
        }
    ]
};

module.exports = new class extends Connector {
    constructor () {
        super(module);
    }

    async getRemediationsAccess () {
        return ACCESS;
    }

    async ping () {
        await this.getRemediationsAccess();
    }
}();
