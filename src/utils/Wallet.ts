/* istanbul ignore file */

import Chains from "./Chains";
import { tokenTestAddresses, tokenAddresses } from '../constants/addresses'

/**
 * Wallet utils object
 * @constructor Wallet
 * @param {(ETH|BSC|MATIC|DOT)=} network The network where the token contract is. (Default: ETH)
 * @param {Boolean=} test ? Specifies if we're on test env (Default: false)
*/
class Wallet {
    private network: string;
    private test: boolean;
    private tokenAddress: typeof tokenAddresses;

    constructor(network = 'ETH', test = false) {
        Chains.checkIfNetworkIsSupported(network);

        this.network = network;
        this.test = test;
        this.tokenAddress = test ? tokenTestAddresses : tokenAddresses;
    }

    /**
	 * @function addTokenToWallet
	 * @description Adds POLS token to user's wallet
	 */
    addTokenToWallet = async () => {
        if (window.ethereum) {
            await window.ethereum.request({
                method: 'metamask_watchAsset',
                params: {
                    "type": "ERC20",
                    "options": {
                      "address": this.tokenAddress,
                      "symbol": "POLS",
                      "decimals": 18
                    },
                  },
            });
        }
    }
}

export default Wallet;