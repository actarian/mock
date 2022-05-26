const config = require("./sso.config");

function SingleSignOnGuard(req, res, next) {
	console.log('SingleSignOnGuard');
	// simple check to see if the user is authenicated or not,
	// if not redirect the user to the SSO Server for Login
	// pass the redirectUrl as currentUrl
	// serviceUrl is where the sso should redirect in case of valid user
	if (req.session.verifyToken == null) {
		const redirectUrl = `${req.protocol}://${req.headers.host}${req.path}`;
		const ssoUrl = config.sso.loginUrl.replace('{redirectUrl}', redirectUrl);
		console.log('SingleSignOnGuard', ssoUrl, redirectUrl);
		return res.redirect(ssoUrl);
	}
	console.log('SingleSignOnGuard', req.session.verifyToken);
	next();
};

module.exports = SingleSignOnGuard;
