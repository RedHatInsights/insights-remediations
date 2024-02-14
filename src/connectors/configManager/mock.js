'use strict';

const Connector = require('../Connector');

module.exports = new class extends Connector {
    constructor () {
        super(module);
    }

    async getCurrentProfile () {
        return {
            account_id: '654321',
            active: true,
            created_at: '2024-02-14T16:05:43.373531Z',
            creator: 'redhat',
            name: '6089719-a2789bb0-3702-4d63-97de-a68374d871ad',
            org_id: '11789772',
            id: 'c5639a03-4640-4ae3-93ce-9966cae18df7',
            label: 'b7839a03-4640-4ae3-93ce-9966cae18df8',
            compliance: true,
            insights: true,
            remediations: true
        };
    }

    async ping () {
        return this.getCurrentProfile();
    }
}();
