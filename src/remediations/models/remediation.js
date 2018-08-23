'use strict';

module.exports = (sequelize, DataTypes) => {
    const Remediation = sequelize.define('remediation', {
        id: {
            type: DataTypes.UUID,
            primaryKey: true
        },
        name: {
            type: DataTypes.STRING,
            get() {
                const value = this.getDataValue('name');

                if (value === null) {
                    return ''; // MARK: OpenAPI 2.0 does not allow nullable types
                }

                return value;
            }
        }
    });

    return Remediation;
};
