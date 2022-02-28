import { SupportedNetworks, networkUrls } from '@constants';

/**
 * Chains object
 * @constructor Chains
 */
class Chains {
  static checkIfNetworkIsSupported = (network: string) => {
    if (!this.isNetworkSupported(network)) {
      throw new Error('Network has to be ETH, DOT, BSC, MATIC, CELO or AVAX');
    }
  };

  static isNetworkSupported = (network: string) => {
    return ['ETH', 'DOT', 'BSC', 'MATIC', 'CELO', 'AVAX'].includes(network);
  };

  static getRpcUrl = (network: SupportedNetworks, mainnet = true) => {
    return mainnet ? networkUrls[network].main : networkUrls[network].test;
  };
}

export default Chains;
