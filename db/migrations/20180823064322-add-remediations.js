'use strict';

module.exports = {
    async up (q, DataTypes) {
        await q.createTable('remediations', {
            id: {
                type: DataTypes.UUID,
                primaryKey: true
            },
            name: {
                type: DataTypes.STRING
            }
        });
    },

    async down (q) {
        await q.dropTable('remediations');
    }
};
