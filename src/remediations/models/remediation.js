'use strict';

module.exports = (sequelize, {INTEGER, STRING, UUID}) => {
    const Remediation = sequelize.define('remediation', {
        id: {
            type: UUID,
            primaryKey: true
        },
        name: {
            type: STRING,
            get() {
                const value = this.getDataValue('name');

                if (value === null) {
                    return ''; // MARK: OpenAPI 2.0 does not allow nullable types
                }

                return value;
            }
        },
        tenant: {
            type: STRING,
            allowNull: false
        },
        owner: {
            type: INTEGER,
            allowNull: false
        }
    }, {
        timestamps: true
    });

    return Remediation;
};
