'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Make plan_retention_days and plan_warning_days nullable and remove default values
    // to support the override pattern: null = use system default, non-null = custom override
    await queryInterface.changeColumn('org_config', 'plan_retention_days', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null
    });

    await queryInterface.changeColumn('org_config', 'plan_warning_days', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null
    });
  },

  async down (queryInterface, Sequelize) {
    // Revert to non-nullable with default values
    // Note: This will fail if any rows have null values
    await queryInterface.changeColumn('org_config', 'plan_retention_days', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 120
    });

    await queryInterface.changeColumn('org_config', 'plan_warning_days', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 30
    });
  }
};
