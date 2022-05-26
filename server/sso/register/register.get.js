const config = require("../sso.config");

function registerGet(req, res, next) {
	const redirectUrl = `${req.protocol}://${req.headers.host}/sso/token`;
	const register = config.sso.registerUrl.replace('{redirectUrl}', redirectUrl);
	console.log('registerGet', register, redirectUrl);
	return res.redirect(register);
};

module.exports = registerGet;
