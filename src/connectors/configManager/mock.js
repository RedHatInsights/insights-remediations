'use strict';

const Connector = require('../Connector');

module.exports = new class extends Connector {
    constructor () {
        super(module);
    }

    async getCurrentState () {
        return {
            account: '654321',
            state: {
                compliance_openscap: 'enabled',
                insights: 'enabled',
                remediations: 'enabled'
            },
            id: 'c5639a03-4640-4ae3-93ce-9966cae18df7',
            label: 'b7839a03-4640-4ae3-93ce-9966cae18df8'
        };
    }

    async ping () {
        return this.getCurrentState();
    }
}();
