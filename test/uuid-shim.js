const { randomUUID } = require('crypto');
function v4() {
  return randomUUID();
}
function v1() {
  return randomUUID();
}
function v3() {
  return randomUUID();
}
function v5() {
  return randomUUID();
}
function v6() {
  return randomUUID();
}
function v7() {
  return randomUUID();
}
function validate(s) {
  return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
function version(s) {
  if (!validate(s)) throw new TypeError('Invalid UUID');
  return parseInt(s.charAt(14), 16);
}
function parse(s) {
  return Buffer.from(s.replace(/-/g, ''), 'hex');
}
function stringify(buf) {
  const hex = Buffer.from(buf).toString('hex');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`;
}
const NIL = '00000000-0000-0000-0000-000000000000';
const MAX = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
module.exports = { v1, v3, v4, v5, v6, v7, validate, version, parse, stringify, NIL, MAX };
module.exports.default = module.exports;
