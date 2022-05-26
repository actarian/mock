const { RoleType } = require('../../api/api.js');

function tokenGet(req, res, next) {
	const status = req.session.decodedToken != null ? 'success' : 'failure';
	if (status === 'success') {
		const user = Object.assign({ type: RoleType.SelfService }, req.session.decodedToken.user);
		req.session.user = user;
	} else {
		req.session.user = null;
	}
	res.render('token', {
		title: 'BHere SSO Consumer | Token',
		status: req.session.decodedToken != null ? 'success' : 'failure',
	});
};

module.exports = tokenGet;
