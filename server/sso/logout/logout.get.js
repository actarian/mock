const config = require("../sso.config");

function logoutGet(req, res, next) {
	const redirectUrl = `${req.protocol}://${req.headers.host}`;
	const logout = config.sso.logoutUrl.replace('{redirectUrl}', redirectUrl);
	console.log('logoutGet', logout, redirectUrl);
	return res.redirect(logout);
};

module.exports = logoutGet;
