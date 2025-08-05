'use strict';

module.exports = {
    async up (q, {DATE, fn, STRING, UUID}) {
        await q.createTable('systems', {
            id: {
                type: UUID,
                primaryKey: true,
                comment: 'HBI inventory id'
            },
            hostname: {
                type: STRING(255),
                allowNull: true,
                comment: 'System FQDN'
            },
            display_name: {
                type: STRING(255),
                allowNull: true,
                comment: 'Display name of system'
            },
            ansible_hostname: {
                type: STRING(255),
                allowNull: true,
                comment: 'Ansible hostname of system'
            },
            created_at: {
                type: DATE,
                allowNull: false,
                defaultValue: fn('now')
            },
            updated_at: {
                type: DATE,
                allowNull: false,
                defaultValue: fn('now')
            }
        });

        await q.addIndex('systems', ['hostname']);
        await q.addIndex('systems', ['display_name']);
    },

    async down (q) {
        await q.removeIndex('systems', ['hostname']);
        await q.removeIndex('systems', ['display_name']);
        await q.dropTable('systems');
    }
}; 
