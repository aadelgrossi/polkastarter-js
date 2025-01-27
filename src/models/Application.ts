/* eslint-disable import/no-named-as-default */
import Web3 from 'web3';

import Chains from '../utils/Chains';
import Network from '../utils/Network';
import Signer from '../utils/Signer';
import Wallet from '../utils/Wallet';
import Account from './Account';
// import Contract from './Contract';
import ERC20TokenContract from './ERC20TokenContract';
import FixedSwapContract from './FixedSwapContract';
import FixedSwapContractLegacy from './FixedSwapContractLegacy';
import Staking from './Staking';

const TEST_PRIVATE_KEY =
  '0x7f76de05082c4d578219ca35a905f8debe922f1f00b99315ebf0706afc97f132';

/**
 * Polkastarter Application Object
 * @constructor Application
 * @param {(ETH|BSC|MATIC|DOT)=} network Current network (Default = ETH)
 * @param {Boolean=} mainnet Specifies if we're on mainnet or tesnet (Default = true);
 * @param {Boolean=} test ? Specifies if we're on test env
 * @param {Web3=} web3 Custom Web3 instance. If not provided the Application will instance it for you. (Default: undefined)
 */

type Chain = 'ETH' | 'BSC' | 'MATIC' | 'DOT';
type ConstructorArgs = { test: boolean; network?: Chain; web3?: Web3 };
type GetUserACcountParams = { privateKey: string };
type GetFixedSwapContractArgs = {
  tokenAddress: string;
  contractAddress?: string;
};
type GetStakingArgs = { tokenAddress?: string; contractAddress?: string };
type GetTokenContractArgs = { tokenAddress: string };

interface Application {
  startWithoutMetamask: () => void;
  start: () => void;
  login: () => void;
  __getUserAccount: (args: GetUserACcountParams) => Account;
  getSigner: () => Signer;
  getNetworkUtils: () => Network;
  getWalletUtils: () => Wallet;
  getFixedSwapContract: (
    args: GetFixedSwapContractArgs
  ) => Promise<FixedSwapContract | FixedSwapContractLegacy>;
  getERC20TokenContract: (args: GetTokenContractArgs) => ERC20TokenContract;
  getETHNetwork: () => Promise<string>;
  getAddress: () => Promise<string>;
  getETHBalance: () => Promise<string>;
}

class ApplicationImpl implements Application {
  private test: boolean;

  private mainnet: boolean;

  private network: Chain;

  private web3: Web3;

  private account: Account;

  constructor(args: ConstructorArgs) {
    const { test = false, network = 'ETH', web3 } = args;
    this.test = test;
    global.IS_TEST = test;
    this.mainnet = !test;
    Chains.checkIfNetworkIsSupported(network);
    this.network = network;

    if (this.test) {
      if (!web3) {
        this.start();
      } else {
        this.web3 = web3;
      }
      this.login();
      this.account = new Account(
        this.web3,
        this.web3.eth.accounts.privateKeyToAccount(TEST_PRIVATE_KEY)
      );
    }
  }

  /**
   * @function startWithoutMetamask
   * @description Starts an instance of web3 for read-only methods
   */
  startWithoutMetamask = () => {
    const rpc = Chains.getRpcUrl(this.network, this.mainnet);
    if (rpc) {
      this.web3 = new Web3(rpc);
    }
  };

  /**
   * @function start
   * @description Starts an instance of web3
   */
  start = () => {
    const rpc = Chains.getRpcUrl(this.network, this.mainnet);
    if (rpc) {
      this.web3 = new Web3(rpc);
    }

    if (typeof window !== 'undefined' && window.ethereum) {
      window.web3 = new Web3(window.ethereum);
      this.web3 = window.web3;
    }
  };

  /**
   * @function login
   * @description Logins with metamask
   */
  login = async () => {
    console.log('Login being done');

    if (typeof window === 'undefined') return false;

    if (window.ethereum) {
      window.web3 = new Web3(window.ethereum);
      this.web3 = window.web3;
      await window.ethereum.enable();
      return true;
    }
    return false;
  };

  __getUserAccount = ({ privateKey }: GetUserACcountParams) => {
    return new Account(
      this.web3,
      this.web3.eth.accounts.privateKeyToAccount(privateKey)
    );
  };

  /**
   * @function getSigner
   * @description Returns the Signer instance.
   */
  getSigner = () => {
    return new Signer();
  };

  /**
   * @function getNetworkUtils
   * @description Returns the Network Utils instance.
   */
  getNetworkUtils = () => {
    return new Network(this.network, !this.mainnet, this.getETHNetwork);
  };

  /**
   * @function getWalletUtils
   * @description Returns the Wallet Utils instance.
   */
  getWalletUtils = () => {
    return new Wallet(this.network, !this.mainnet);
  };

  /**
   * @function getStaking
   * @param {string=} contractAddress The staking contract address. (Default: Predefined addresses depending on the network)
   * @param {string=} tokenAddress The staking token address. (Default: Predefined addresses depending on the network)
   * @description Returns the Staking Model instance.
   */
  getStaking = ({
    contractAddress = null,
    tokenAddress = null,
  }: GetStakingArgs) => {
    return new Staking({
      web3: this.web3,
      acc: this.test ? this.account : null,
      contractAddress,
      tokenAddress,
      network: this.network,
      test: this.test,
    });
  };

  /**
   * @function getFixedSwapContract
   * @param {string} tokenAddress The token address we want to trade
   * @param {string=} contractAddress The swap contract address, in case t hat has already been instanced. (Default = null)
   * @description Returns Fixed Swap instance
   */
  getFixedSwapContract = async ({
    tokenAddress,
    contractAddress = null,
  }: GetFixedSwapContractArgs) => {
    if (!contractAddress) {
      // Not deployed
      return new FixedSwapContract({
        web3: this.web3,
        tokenAddress,
        contractAddress,
        acc: this.test ? this.account : null,
      });
    }
    // Deployed
    try {
      const contract = new FixedSwapContract({
        web3: this.web3,
        tokenAddress,
        contractAddress,
        acc: this.test ? this.account : null,
      });
      contract.isETHTrade();

      return contract;
    } catch (err) {
      return new FixedSwapContractLegacy({
        web3: this.web3,
        decimals: 3,
        tokenAddress,
        contractAddress,
        acc: this.test ? this.account : null,
      });
    }
  };

  /**
   * @function getERC20TokenContract
   * @param {string} tokenAddress The token address
   * @description Returns ERC20 instance
   */
  getERC20TokenContract = ({ tokenAddress }: GetTokenContractArgs) => {
    return new ERC20TokenContract({
      web3: this.web3,
      contractAddress: tokenAddress,
      acc: this.test ? this.account : null,
    });
  };

  /**
   * @function getETHNetwork
   * @description Returns the current network
   */
  getETHNetwork = async () => {
    const netId = await this.web3.eth.net.getId();
    const networksEnum = Chains.getNetworksEnum();
    const networkName = networksEnum.hasOwnProperty(netId)
      ? networksEnum[netId]
      : 'Unknown';
    return networkName;
  };

  /**
   * @function getAddress
   * @description Returns the connected user address
   */
  getAddress = async () => {
    const accounts = await this.web3.eth.getAccounts();
    return accounts[0];
  };

  /**
   * @function getETHBalance
   * @description Returns the native currency of the connected user wallet.
   */
  getETHBalance = async () => {
    const address = await this.getAddress();
    const wei = await this.web3.eth.getBalance(address);
    return this.web3.utils.fromWei(wei, 'ether');
  };
}

export default ApplicationImpl;
