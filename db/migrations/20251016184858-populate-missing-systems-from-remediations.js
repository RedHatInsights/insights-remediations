'use strict';

module.exports = {
  async up() {
    // Migration skipped - will be reimplemented in a future migration
  },

  async down() {
    // we're only adding data so we don't need to do anything on rollback
  },
  
  transaction: false
};
