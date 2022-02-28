/* eslint-disable mocha/no-setup-in-describe */
/* eslint-disable global-require */

context('Tests', () => {
  require('./utils/numbers');
  require('./utils/signer');
  require('./test/eth');
  require('./test/stake');
  require('./test/nft');
  // require('./test/nft-whitelist');
  // require('./test/vesting');
  // require('./test/erc20');
});
