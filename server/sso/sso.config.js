const { readFileSync } = require('../core/utils/utils');

const SSO_PUBLIC_KEY = process.env.SSO_PUBLIC_KEY || readFileSync(__dirname, './sso.key');

// const origin = 'http://localhost:3010';
const origin = 'https://b-here-sso.herokuapp.com';

const config = {
	sso: {
		secret: 'l1Q7zkOL59cRqWBkQ12ZiGVW2DBL',
		publicKey: SSO_PUBLIC_KEY,
		issuer: 'bhere-sso',
		origin: `${origin}`,
		loginUrl: `${origin}/sso/login?redirectUrl={redirectUrl}`,
		logoutUrl: `${origin}/sso/logout?redirectUrl={redirectUrl}`,
		registerUrl: `${origin}/sso/register?redirectUrl={redirectUrl}`,
		verifyTokenUrl: `${origin}/sso/verifytoken?verifyToken={verifytoken}`,
	}
};

if (process.env.SSO_SECRET) {
	config.sso.secret = process.env.SSO_SECRET;
}
if (process.env.SSO_PUBLIC_KEY) {
	config.sso.publicKey = process.env.SSO_PUBLIC_KEY;
}
if (process.env.SSO_ISSUER) {
	config.sso.issuer = process.env.SSO_ISSUER;
}
if (process.env.SSO_ORIGIN) {
	config.sso.origin = process.env.SSO_ORIGIN;
}
if (process.env.SSO_LOGIN_URL) {
	config.sso.loginUrl = process.env.SSO_LOGIN_URL;
}
if (process.env.SSO_LOGOUT_URL) {
	config.sso.logoutUrl = process.env.SSO_LOGOUT_URL;
}
if (process.env.SSO_REGISTER_URL) {
	config.sso.registerUrl = process.env.SSO_REGISTER_URL;
}
if (process.env.SSO_VERIFY_TOKEN_URL) {
	config.sso.verifyTokenUrl = process.env.SSO_VERIFY_TOKEN_URL;
}

console.log(config.sso);

module.exports = config;
