require('dotenv').config();

const { serve } = require('./server/main.js');

const app = serve({ dirname: __dirname, baseHref: process.env.BASE_HREF });
