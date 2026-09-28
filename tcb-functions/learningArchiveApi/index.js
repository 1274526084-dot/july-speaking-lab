/* oxlint-disable typescript/no-require-imports */
const cloudbase = require('@cloudbase/node-sdk');
const { createApi } = require('./service');
const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
exports.main = createApi({ db: app.database(), storage: app });
