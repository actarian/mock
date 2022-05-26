const fs = require('fs');
const path = require('path');

const Roles = {
  Admin: 'admin',
  Editor: 'editor',
  User: 'user',
};

let pathname = path.join(process.cwd(), `/store/store.json`);

let db = {};

function uuid() {
  // return new Date().getTime();
  return parseInt(process.hrtime.bigint().toString());
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

function findOne_(request, response, params, query, items) {
  let item = items.find(x => x.id === params.id);
  if (!item) {
    sendError(response, 404, 'Not Found');
  }
  return decorate_(item, params, query);
}

function findMany_(request, response, params, query, items) {
  return items.map(item => decorate_(item, params, query));
}

async function create_(request, response, params, query, items) {
  const body = request.body;
  const id = uuid();
  const item = Object.assign({}, body, { id });
  items.push(item);
  await saveStore();
  sendOk(response, item);
}

async function update_(request, response, params, query, items) {
  const body = request.body;
  const item = items.find(x => x.id === body.id);
  if (item) {
    Object.assign(item, body);
    await saveStore();
    sendOk(response, item);
  } else {
    sendError(response, 404, 'Not Found');
  }
}

async function delete_(request, response, params, query, items) {
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

function decorate_(item, params, query) {
  // console.log(query);
  if (query.locale) {
    return localizeItem(item, query.locale);
  } else {
    return item;
  }
}

function isLocalizedString(value) {
  let isLocalizedString = false;
  if (value) {
    if (!Array.isArray(value) && typeof value === 'object') {
      const matchKeys = Object.keys(value).reduce((p, c) => p && /^(\w{2})(-\w{2})?$/.test(c), true);
      const matchValues = Object.values(value).reduce((p, c) => p && typeof c === 'string', true);
      // console.log(matchKeys, matchValues);
      isLocalizedString = Boolean(matchKeys && matchValues);
    }
  }
  return isLocalizedString;
}

function localizedToString(json, locale = 'en', defaultLocale = 'en') {
  const localizedString = json[locale] || json[defaultLocale] || Object.values(json)[0];
  return localizedString;
}

function localizeValue(value, locale = 'en', defaultLocale = 'en') {
  if (value) {
    if (isLocalizedString(value)) {
      return localizedToString(value, locale, defaultLocale);
    } else {
      return localizeItem(value, locale, defaultLocale);
    }
  }
}

function localizeItem(item, locale = 'en', defaultLocale = 'en') {
  if (!Array.isArray(item) && typeof item === 'object') {
    item = Object.assign({}, item);
    Object.keys(item).forEach(key => {
      item[key] = localizeValue(item[key], locale, defaultLocale);
    });
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

function getApiRoutes(db) {
  let ROUTES = [];
  // console.log(db);
  Object.keys(db).forEach(key => {
    const collection = db[key];
    // console.log(key, collection, db);
    const name = collection.singularName || key;
    const items_ = collection.items || collection;
    const collectionRoutes = [
      {
        path: `/api/${name}/:id`, method: 'GET', callback: async function(request, response, params) {
          console.log('GET', request.url);
          const item = findOne_(request, response, params, request.query, items_);
          if (item) {
            sendOk(response, item);
          }
        }
      }, {
        path: `/api/${name}`, method: 'GET', callback: async function(request, response, params) {
          console.log('GET', request.url);
          const items = findMany_(request, response, params, request.query, items_);
          sendOk(response, items);
        }
      }, {
        path: `/api/${name}`, method: 'POST', callback: async function(request, response, params) {
          console.log('POST', request.url);
          await create_(request, response, params, request.query, items_);
        }
      }, {
        path: `/api/${name}/:id`, method: 'PUT', callback: async function(request, response, params) {
          console.log('PUT', request.url);
          await update_(request, response, params, request.query, items_);
        }
      }, {
        path: `/api/${name}/:id`, method: 'DELETE', callback: async function(request, response, params) {
          console.log('DELETE', request.url);
          await delete_(request, response, params, request.query, items_);
        }
      },
    ];
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

  await readStore();

  const ROUTES = getApiRoutes(db);

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
  userType = userType || Roles.User;
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
  uuid,
  Roles,
  setSessionUser,
};
