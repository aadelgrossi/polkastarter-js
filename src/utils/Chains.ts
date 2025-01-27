const ETH_URL_MAINNET =
  'https://mainnet.infura.io/v3/40e2d4f67005468a83e2bcace6427bc8';
const ETH_URL_TESTNET =
  'https://kovan.infura.io/v3/40e2d4f67005468a83e2bcace6427bc8';
const MOONBEAM_URL = 'https://rpc.api.moonbeam.network';
const MOONBEAM_TESTNET_URL = 'https://rpc.api.moonbase.moonbeam.network';
const BINANCE_CHAIN_TESTNET_URL =
  'https://data-seed-prebsc-1-s1.binance.org:8545';
const BINANCE_CHAIN_URL = 'https://bsc-dataseed1.binance.org:443';
const POLYGON_CHAIN_TESTNET_URL = 'https://rpc-mumbai.maticvigil.com/';
const POLYGON_CHAIN_URL = 'https://rpc-mainnet.maticvigil.com/';
const CELO_CHAIN_URL = 'https://forno.celo.org';
const CELO_CHAIN_TESTNET_URL = 'https://alfajores-forno.celo-testnet.org';
const AVAX_CHAIN_URL = 'https://api.avax.network/ext/bc/C/rpc';
const AVAX_CHAIN_TESTNET_URL = 'https://api.avax-test.network/ext/bc/C/rpc';

const networksEnum = Object.freeze({
  1: 'Ethereum Main',
  2: 'Morden',
  3: 'Ropsten',
  4: 'Rinkeby',
  56: 'BSC Main',
  97: 'BSC Test',
  42: 'Kovan',
  137: 'Polygon',
  80001: 'Mumbai',
  44787: 'Celo Testnet',
  42220: 'Celo',
  43114: 'Avalanche',
  43113: 'Avalanche Testnet',
  1284: 'Moonbeam',
  1287: 'Moonbeam Testnet',
});

/**
 * Chains object
 * @constructor Chains
 */
class Chains {
  private readonly networksEnum = Object.freeze({
    1: 'Ethereum Main',
    2: 'Morden',
    3: 'Ropsten',
    4: 'Rinkeby',
    56: 'BSC Main',
    97: 'BSC Test',
    42: 'Kovan',
    137: 'Polygon',
    80001: 'Mumbai',
    44787: 'Celo Testnet',
    42220: 'Celo',
    43114: 'Avalanche',
    43113: 'Avalanche Testnet',
    1284: 'Moonbeam',
    1287: 'Moonbeam Testnet',
  });

  checkIfNetworkIsSupported = (network: string) => {
    if (!this.isNetworkSupported(network)) {
      throw new Error('Network has to be ETH, DOT, BSC, MATIC, CELO or AVAX');
    }
  };

  isNetworkSupported = (network: string) => {
    return ['ETH', 'DOT', 'BSC', 'MATIC', 'CELO', 'AVAX'].includes(network);
  };

  getRpcUrl = (network: string, mainnet = true) => {
    if (network === 'DOT') {
      return mainnet ? MOONBEAM_URL : MOONBEAM_TESTNET_URL;
    }
    if (network === 'BSC') {
      return mainnet ? BINANCE_CHAIN_URL : BINANCE_CHAIN_TESTNET_URL;
    }
    if (network === 'ETH') {
      return mainnet ? ETH_URL_MAINNET : ETH_URL_TESTNET;
    }
    if (network === 'MATIC') {
      return mainnet ? POLYGON_CHAIN_URL : POLYGON_CHAIN_TESTNET_URL;
    }
    if (network === 'CELO') {
      return mainnet ? CELO_CHAIN_URL : CELO_CHAIN_TESTNET_URL;
    }
    if (network === 'AVAX') {
      return mainnet ? AVAX_CHAIN_URL : AVAX_CHAIN_TESTNET_URL;
    }
  };

  getNetworksEnum = () => networksEnum;
}

export default new Chains();
