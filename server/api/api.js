const fs = require('fs');
const path = require('path');

const RoleType = {
	Publisher: 'publisher',
	Attendee: 'attendee',
	Streamer: 'streamer',
	Viewer: 'viewer',
	SmartDevice: 'smart-device',
	SelfService: 'self-service',
	Embed: 'embed',
};

let db = {};

let pathname;

function uuid() {
	// return new Date().getTime();
	return parseInt(process.hrtime.bigint().toString());
}

function useApi() {
	return null;
}

async function readStore(callback) {
	return new Promise((resolve, reject) => {
		fs.readFile(pathname, 'utf8', (error, data) => {
			if (error) {
				console.log('NodeJs.Api.readStore.error', error, pathname);
				reject(error);
			} else {
				try {
					db = Object.assign(db, JSON.parse(data));
					resolve(db);
				} catch (error) {
					console.log('NodeJs.Api.readStore.error', error, pathname);
					reject(error);
				}
			}
		});
	});
}

async function saveStore() {
	return new Promise((resolve, reject) => {
		const data = JSON.stringify(db, null, 2);
		fs.writeFile(pathname, data, 'utf8', (error, data) => {
			if (error) {
				console.log('NodeJs.Api.saveStore.error', error, pathname);
				return reject(error);
			}
			resolve(db);
		});
	});
}

function sendError(response, status, message) {
	response.status(status).set('Content-Type', 'application/json').send(JSON.stringify({ status, message }));
}

function sendOk(response, data) {
	if (data) {
		response.status(200).set('Content-Type', 'application/json').send(JSON.stringify(data));
	} else {
		response.status(200).set('Content-Type', 'text/plain').send();
	}
}

async function doCreate(request, response, params, items) {
	const body = request.body;
	const id = uuid();
	const item = Object.assign({}, body, { id });
	if (item.items) {
		item.items.forEach(x => x.id = uuid());
	}
	if (item.tiles) {
		item.tiles.forEach(x => x.id = uuid());
	}
	if (item.navs) {
		item.navs.forEach(x => x.id = uuid());
	}
	doSetLocale(item, params);
	items.push(item);
	await saveStore();
	sendOk(response, item);
}

async function doUpdate(request, response, params, items) {
	const body = request.body;
	const item = items.find(x => x.id === body.id);
	if (item) {
		Object.assign(item, body);
		doSetLocale(item, params);
		await saveStore();
		sendOk(response, item);
	} else {
		sendError(response, 404, 'Not Found');
	}
}

async function doDelete(request, response, params, items) {
	const index = items.reduce((p, x, i) => x.id === params.id ? i : p, -1);
	if (index !== -1) {
		// const item = items[index];
		items.splice(index, 1);
		await saveStore();
		// sendOk(response, item);
		sendOk(response);
	} else {
		sendError(response, 404, 'Not Found');
	}
}

function doGet(request, response, params, items) {
	let item = items.find(x => x.id === params.id);
	if (!item) {
		sendError(response, 404, 'Not Found');
	}
	return item;
}

function doSetLocale(item, params) {
	const language = params.languageCode;
	if (language) {
		const localized = Object.assign({}, item);
		delete localized.locale;
		const locale = item.locale = (item.locale || {});
		locale[language] = localized;
		console.log('doSetLocale.languageCode', language);
	}
	return item;
}

function parseRoutes(ROUTES) {
	ROUTES.forEach(route => {
		const segments = [];
		if (route.path === '**') {
			segments.push(route.path);
			route.matcher = new RegExp('^.*$');
		} else {
			const matchers = [`^`];
			const regExp = /(^\.\.\/|\.\/|\/\/|\/)|([^:|\/]+)\/?|\:([^\/]+)\/?/g;
			let relative;
			let match;
			while ((match = regExp.exec(route.path)) !== null) {
				const g1 = match[1];
				const g2 = match[2];
				const g3 = match[3];
				if (g1) {
					relative = !(g1 === '//' || g1 === '/');
				} else if (g2) {
					matchers.push(`\/(${g2})`);
					segments.push({ name: g2, param: null, value: null });
				} else if (g3) {
					matchers.push('\/([^\/]+)');
					const params = {};
					params[g3] = null;
					route.params = params;
					segments.push({ name: '', param: g3, value: null });
				}
			}
			matchers.push('$');
			const regexp = matchers.join('');
			// console.log(regexp);
			route.matcher = new RegExp(regexp);
		}
		route.segments = segments;
	});
	return ROUTES;
}

function getRoutes(db) {
	let ROUTES = [];
	// console.log(db);

	Object.keys(db).forEach(key => {
		const collection = db[key];
		// console.log(key, collection, db);

		const collectionRoutes = [
			{
				path: `/api/${collection.singularName}`, method: 'GET', callback: async function(request, response, params) {
					sendOk(response, db[key].items);
				}
			}, {
				path: `/api/${collection.singularName}/:id`, method: 'GET', callback: async function(request, response, params) {
					const view = doGet(request, response, { id: params.id }, db[key].items);
					if (view) {
						sendOk(response, view);
					}
				}
			}, {
				path: `/api/${collection.singularName}`, method: 'POST', callback: async function(request, response, params) {
					await doCreate(request, response, params, db[key].items);
				}
			}, {
				path: `/api/${collection.singularName}/:id`, method: 'PUT', callback: async function(request, response, params) {
					await doUpdate(request, response, params, db[key].items);
				}
			}, {
				path: `/api/${collection.singularName}/:id`, method: 'DELETE', callback: async function(request, response, params) {
					await doDelete(request, response, { id: params.viewId }, db[key].items);
				}
			},
		]
		ROUTES.push(...collectionRoutes);
	});
	ROUTES = parseRoutes(ROUTES);
	return ROUTES;
}

async function apiMiddleware(options) {
	if (!options.root) {
		throw new Error('missing Vars.root!');
	}
	if (!options.baseHref) {
		throw new Error('missing Vars.baseHref!');
	}

	pathname = path.join(options.dirname, `/store/store.json`);

	await readStore();

	const ROUTES = getRoutes(db);

	// console.log('ROUTES', ROUTES);

	return (request, response, next) => {
		const url = request.baseUrl.replace(/\\/g, '/');
		const params = {};
		const method = ROUTES.find(route => {
			if (route.method.toLowerCase() === request.method.toLowerCase()) {
				const match = url.match(route.matcher);
				if (match) {
					route.segments.forEach((x, i) => {
						if (x.param) {
							let value = match[i + 1];
							if (parseInt(value).toString() === value) {
								value = parseInt(value);
							}
							params[x.param] = value;
						}
					});
					// console.log('match', match, route);
					return true;
				}
			}
		});
		if (method) {
			console.log('apiMiddleware.url', url, method.path, method.method, params);
			method.callback(request, response, params);
		} else {
			next();
		}
	};
};

function setSessionUser(request, userType) {
	userType = userType || RoleType.SelfService;
	const id = uuid();
	const user = {
		id,
		type: userType,
		username: userType,
		password: '****',
		firstName: 'Jhon',
		lastName: 'Appleseed',
	};
	request.session.user = user;
}

module.exports = {
	apiMiddleware,
	useApi,
	uuid,
	RoleType,
	setSessionUser,
};
