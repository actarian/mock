const axios = require('axios');
const { decodeToken } = require('./sso-token.service');
const config = require('./sso.config');
const { URL } = require('url');

async function SingleSignOnTokenInterceptor(req, res, next) {
	// check if the req has the queryParameter as verifyToken
	// and who is the referer.
	const { verifyToken } = req.query;
	if (verifyToken != null) {
		// to remove the verifyToken in query parameter redirect.
		const requestUrl = new URL(req.url, `${req.protocol}://${req.headers.host}`);
		const redirectURL = requestUrl.pathname;
		try {
			const ssoVerifyUrl = config.sso.verifyTokenUrl.replace('{verifytoken}', verifyToken);
			const response = await axios.get(ssoVerifyUrl, {
				headers: {
					Authorization: `Bearer ${config.sso.secret}`
				}
			});
			const { token } = response.data;
			console.log('SingleSignOnTokenInterceptor.token', token);
			const decodedToken = await decodeToken(token);
			console.log('SingleSignOnTokenInterceptor.decodedToken', decodedToken);
			// now that we have the decoded jwt,
			// use the token sessionId as the global session id so that
			// the logout can be implemented with the global session.
			req.session.verifyToken = verifyToken;
			req.session.decodedToken = decodedToken;
		} catch (error) {
			if (error.response) {
				// The client was given an error response (5xx, 4xx)
				console.log('SingleSignOnTokenInterceptor.responseError', error.response.status, error.response.data, error.response.headers);
			} else if (error.request) {
				// The client never received a response, and the request was never left
				console.log('SingleSignOnTokenInterceptor.requestError', error.request);
			} else {
				// Anything else
				console.log('SingleSignOnTokenInterceptor.error', error.message);
			}
			return next(error);
		}
		console.log('SingleSignOnTokenInterceptor.redirectURL', redirectURL);
		return res.redirect(`${redirectURL}`);
	}
	return next();
}

module.exports = SingleSignOnTokenInterceptor;
