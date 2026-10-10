// Entorno de pruebas: BD aislada (prestige_test) y almacenamiento temporal.
process.env.NODE_ENV = 'test';
process.env.LOGIN_THROTTLE_LIMIT = '500';
process.env.FORGOT_THROTTLE_LIMIT = '500';
process.env.STORAGE_DIR = './storage-test';
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config();
