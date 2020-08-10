'use strict';

module.exports = {
    async up (q, {BOOLEAN}) {
        q.addColumn('remediations',
            'archived', {
                type: BOOLEAN,
                allowNull: false,
                defaultValue: false
            }
        );
    },

    async down (q) {
        q.removeColumn('remediations', 'archived');
    }
};
