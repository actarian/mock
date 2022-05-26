const jwt = require('jsonwebtoken');
const config = require('./sso.config');

function decodeToken(token) {
	return new Promise((resolve, reject) => {
		jwt.verify(token, config.sso.publicKey, { issuer: config.sso.issuer, algorithms: ['RS256'] }, (err, decoded) => {
			if (err) {
				return reject(err);
			}
			return resolve(decoded);
		});
	});
}

module.exports = {
	decodeToken,
};
