const express = require('express');
const morgan = require('morgan');
const engine = require('ejs-mate');
const fs = require('fs');
const https = require('https');
const multipart = require('connect-multiparty');
const path = require('path');
const session = require('express-session');
const { staticMiddleware } = require('./static/static.js');
const { apiMiddleware, uuid, setSessionUser, RoleType } = require('./api/api.js');
const SingleSignOnGuard = require('./sso/sso.guard.js');
const SingleSignOnTokenInterceptor = require('./sso/sso-token.interceptor.js');
const ssoRouter = require('./sso/sso.router');

async function serve(options) {
	options = options || {};

	const dirname = options.dirname ? options.dirname : path.join(__dirname, '../');
	const multipartMiddleware = multipart({ uploadDir: path.join(dirname, '/docs/temp/') });

	options = Object.assign({
		dirname: dirname,
		port: 40001,
		portHttps: 40003,
		baseHref: '/mock/',
		charset: 'utf8',
		assets: 'assets/',
		cacheMode: 'file',
		cache: path.join(dirname, '/cache/'),
		root: '/docs/',
		template: path.join(dirname, '/docs/index.html'),
		accessControlAllowOrigin: true,
	}, options);

	if (process.env.PORT) {
		options.port = process.env.PORT;
	}
	if (process.env.PORT_HTTPS) {
		options.portHttps = process.env.PORT_HTTPS;
	}

	options.host = `http://localhost:${options.port}`;
	options.hostHttps = `https://localhost:${options.portHttps}`;

	const staticMiddleware_ = staticMiddleware(options);
	const apiMiddleware_ = await apiMiddleware(options);

	const heroku = (process.env._ && process.env._.indexOf('heroku'));

	const app = express();
	app.use(session({
		secret: 'b-here-secret-keyword',
		saveUninitialized: true,
		resave: true
	}));
	if (heroku) {
		app.enable('trust proxy');
	}
	app.disable('x-powered-by');
	app.use(express.urlencoded({ extended: true }));
	app.use(express.json());
	app.use(express.raw());
	app.use(morgan('dev'));
	app.engine('ejs', engine);
	app.set('views', options.dirname + '/server/views');
	app.set('view engine', 'ejs');
	app.use(SingleSignOnTokenInterceptor);
	app.use('/sso', ssoRouter);

	app.use('*', staticMiddleware_);
	app.use('*', apiMiddleware_);

	app.post('/api/upload', multipartMiddleware, function(request, response) {
		if (options.accessControlAllowOrigin) {
			response.header('Access-Control-Allow-Origin', '*');
		}
		console.log(request.body, request.files);
		const file = request.files.file;
		const id = uuid();
		const fileName = `${id}_${file.name}`;
		const folder = `/uploads/`;
		const input = file.path;
		const output = path.join(dirname, options.root, folder, fileName);
		const upload = {
			id,
			fileName,
			type: file.type,
			originalFileName: file.name,
			url: `${folder}${fileName}`,
		};
		const uploads = [upload];
		fs.copyFile(input, output, (error) => {
			fs.unlink(input, () => { });
			if (error) {
				throw error;
			} else {
				response.status(200).send(JSON.stringify(uploads));
			}
		});
	});
	app.options('/api/upload', function(request, response) {
		console.log('OPTIONS');
		if (options.accessControlAllowOrigin) {
			response.header('Access-Control-Allow-Origin', '*');
		}
		response.status(200).send();
	});

	const isDist = process.env.npm_config_dist;
	console.log('isDist', isDist);

	app.get('/', function(request, response) {
		response.sendFile(path.join(dirname, `/docs/index.html`));
	});

	app.listen(options.port, () => {
		console.log(`NodeJs Running server at ${options.host}`);
	});

	if (!heroku) {
		const privateKey = fs.readFileSync('cert.key', 'utf8');
		const certificate = fs.readFileSync('cert.crt', 'utf8');
		const credentials = { key: privateKey, cert: certificate };
		const serverHttps = https.createServer(credentials, app);
		serverHttps.listen(options.portHttps, () => {
			console.log(`NodeJs Running server at ${options.hostHttps}`);
		});
	}

	return app;
}

module.exports = {
	serve,
};
