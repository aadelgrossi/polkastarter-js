interface NetworkUrls {
  [key: string]: {
    main: string;
    test: string;
  };
}

export const networkUrls: NetworkUrls = {
  AVAX: {
    main: 'https://api.avax.network/ext/bc/C/rpc',
    test: 'https://api.avax-test.network/ext/bc/C/rpc',
  },
  ETH: {
    main: 'https://mainnet.infura.io/v3/40e2d4f67005468a83e2bcace6427bc8',
    test: 'https://kovan.infura.io/v3/40e2d4f67005468a83e2bcace6427bc8',
  },
  CELO: {
    main: 'https://forno.celo.org',
    test: 'https://alfajores-forno.celo-testnet.org',
  },
  BSC: {
    main: 'https://bsc-dataseed1.binance.org:443',
    test: 'https://data-seed-prebsc-1-s1.binance.org:8545',
  },
  MATIC: {
    main: 'https://rpc-mainnet.maticvigil.com/',
    test: 'https://rpc-mumbai.maticvigil.com/',
  },
};

const MOONBEAM_URL = 'https://rpc.api.moonbeam.network';
const MOONBEAM_TESTNET_URL = 'https://rpc.api.moonbase.moonbeam.network';

const AVAX_CHAIN_URL = 'https://api.avax.network/ext/bc/C/rpc';
const AVAX_CHAIN_TESTNET_URL = 'https://api.avax-test.network/ext/bc/C/rpc';

export const networksEnum = Object.freeze({
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

export type SupportedNetworks = 'ETH' | 'BSC' | 'MATIC' | 'CELO';
