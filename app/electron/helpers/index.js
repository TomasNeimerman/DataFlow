module.exports = {
  ...require('./log'),
  ...require('./device'),
  ...require('./security'),
  ...require('./session'),
  ...require('./menu'),
  waitForUrl: require('./waitForUrl'),
};
