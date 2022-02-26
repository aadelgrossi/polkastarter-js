import { BigNumber } from 'mathjs';
import Web3 from 'web3';

/* eslint-disable array-callback-return */
/* eslint-disable @typescript-eslint/return-await */
/* eslint-disable no-useless-catch */
import { Client, Numbers } from '../../../utils';
import { Account, Contract, ERC20TokenContract } from '../../base';

/**
 * Base Swap Contract Object
 * @constructor BaseSwapContract
 * @param {Web3} web3
 * @param {Address} contractAddress ? (opt)
 */

type BaseSwapContractParams = {
  web3: Web3;
  contractAddress: string;
  contract: Contract;
  erc20TokenContract?: ERC20TokenContract;
  tradingERC20Contract?: ERC20TokenContract;
};

type ExecuteContractMethodArgs = {
  methodToExecute: () => void;
  call?: boolean;
  value?: string;
  callback?: (args?: any) => void;
};

class BaseSwapContract {
  web3: Web3;

  version: string;

  acc: Account;

  private contractInterface: any;

  private client: Client;

  params: BaseSwapContractParams;

  constructor({
    web3,
    contractAddress = null /* If not deployed */,
    acc,
    contractInterface,
  }) {
    try {
      if (!web3) {
        throw new Error('Please provide a valid web3 provider');
      }
      this.web3 = web3;
      this.version = '2.0';
      if (acc) {
        this.acc = acc;
      }

      this.params = {
        web3,
        contractAddress,
        contract: new Contract(web3, contractInterface, contractAddress),
      };
      this.contractInterface = contractInterface;
      this.client = new Client();
    } catch (err) {
      throw err;
    }
  }

  __init__() {
    try {
      if (!this.getAddress()) {
        throw new Error('Please add a Contract Address');
      }

      this.__assert();
    } catch (err) {
      throw err;
    }
  }

  /** ************************************
   * WHITELIST METHODS
   ************************************* */

  /**
   * @function hasWhitelisting
   * @description Verify if swap has whitelisting
   * @returns {Boolean}
   */
  async hasWhitelisting() {
    return (await this.getContractMethods()
      .hasWhitelisting()
      .call()) as boolean;
  }

  /**
   * @function isWhitelisted
   * @description Verify if address is whitelisted
   * @param {string} address
   * @returns {Boolean}
   */
  async isWhitelisted({ address }) {
    return (await this.getContractMethods()
      .isWhitelisted(address)
      .call()) as boolean;
  }

  /**
   * @function setHasWhitelisting
   * @type admin
   * @param {boolean} hasWhitelist
   * @description Modifies if the pool has whitelisting or not
   */
  setHasWhitelisting = async ({ hasWhitelist }) => {
    const methodToExecute =
      this.getContractMethods().setHasWhitelisting(hasWhitelist);
    return this.executeContractMethod({ methodToExecute });
  };

  /**
   * @function addWhitelistedAddress
   * @description add WhiteListed Address
   * @param { Address} address
   */
  addWhitelistedAddress = async ({ address }) => {
    let addresses = [address];
    if (!addresses || !addresses.length) {
      throw new Error('Addresses not well setup');
    }

    let oldAddresses = await this.getWhitelistedAddresses();
    addresses = addresses.map((a) => String(a).toLowerCase());
    oldAddresses = oldAddresses.map((a) => String(a).toLowerCase());
    const addressesClean = [];

    addresses = addresses.filter((item) => {
      if (oldAddresses.indexOf(item) < 0 && addressesClean.indexOf(item) < 0) {
        // Does not exist
        addressesClean.push(item);
      }
    });

    const methodToExecute = this.getContractMethods().addToWhitelist(address);
    return this.executeContractMethod({ methodToExecute });
  };

  /**
   * @function removeWhitelistedAddress
   * @param { Array | Addresses} addresses
   * @param {Integer} index
   * @description remove WhiteListed Address
   */
  removeWhitelistedAddress = async ({ address, index }) => {
    const methodToExecute = this.getContractMethods().remove(address, index);
    return this.executeContractMethod({ methodToExecute });
  };

  /**
   * @function setSignerPublicAddress
   * @description Set the public address of the signer
   * @param {string} address
   */
  setSignerPublicAddress = async ({ address }) => {
    const methodToExecute =
      this.getContractMethods().setSignerPublicAddress(address);
    try {
      return await this.executeContractMethod({ methodToExecute });
    } catch (err) {
      throw err;
    }
  };

  /**
   * @function signerPublicAddress
   * @description Get the public address of the signer
   * @returns {string} address
   */

  async signerPublicAddress() {
    return await this.getContractMethods().signerPublicAddress().call();
  }

  /**
   * @function getWhiteListedAddresses
   * @description Get Whitelisted Addresses
   * @returns {Array | Address} addresses
   */

  getWhitelistedAddresses = async () =>
    await this.getContractMethods().getWhitelistedAddresses().call();

  /** ************************************
   * TOKEN METHODS
   ************************************* */

  /**
   * @function getBalance
   * @description Get Balance of Contract
   * @param {Integer} Balance
   */
  getBalance = async () => {
    if (await this.isETHTrade()) {
      const wei = await this.web3.eth.getBalance(this.getAddress());
      return this.web3.utils.fromWei(wei, 'ether');
    }
    return await this.getTokenContract().getTokenAmount(this.getAddress());
  };

  /**
   * @function removeOtherERC20Tokens
   * @description Remove Tokens from other ERC20 Address (in case of accident)
   * @param {Address} tokenAddress
   * @param {Address} toAddress
   */
  removeOtherERC20Tokens = async ({ tokenAddress, toAddress }) => {
    const methodToExecute = this.getContractMethods().removeOtherERC20Tokens(
      tokenAddress,
      toAddress
    );
    return this.executeContractMethod({ methodToExecute });
  };

  /**
   * @function minimumRaise
   * @description Get Minimum Raise amount for Token Sale
   * @returns {Integer} Amount in Tokens
   */
  async minimumRaise() {
    const value = await this.getContractMethods().minimumRaise().call();
    const decimals = await this.getTradingDecimals();
    return Numbers.fromDecimals(value, decimals);
  }

  /**
   * @function hasMinimumRaise
   * @description See if hasMinimumRaise
   * @returns {Boolean}
   */
  async hasMinimumRaise() {
    return (await this.getContractMethods()
      .hasMinimumRaise()
      .call()) as boolean;
  }

  /**
   * @function minimumReached
   * @description See if minimumRaise was Reached
   * @returns {Boolean}
   */
  async minimumReached() {
    const hasMinimumRaise = await this.hasMinimumRaise();
    if (hasMinimumRaise) {
      const tokensAllocated = await this.tokensAllocated();
      const minimumRaise = await this.minimumRaise();
      return tokensAllocated > minimumRaise;
    }
    return true;
  }

  /**
   * @function tokensAllocated
   * @description Get Total tokens spent in the contract, therefore the tokens bought until now
   * @returns {Integer} Amount in Tokens
   */
  async tokensAllocated() {
    return Numbers.fromDecimals(
      await this.params.contract.getContract().methods.tokensAllocated().call(),
      await this.getTradingDecimals()
    );
  }

  /**
   * @function safePull
   * @description Safe Pull all tokens & ETH
   */
  safePull = async () => {
    return this.executeContractMethod({
      methodToExecute: this.getContractMethods().safePull(),
      call: null,
    });
  };

  /**
   * @function withdrawFunds
   * @description Withdraw all funds from tokens sold
   */
  withdrawFunds = async () => {
    const methodToExecute = this.getContractMethods().withdrawFunds();
    return this.executeContractMethod({ methodToExecute });
  };

  /**
   * @function withdrawableFunds
   * @description Get Total funds raised to be withdrawn by the admin
   * @returns {Integer} Amount in ETH
   */
  async withdrawableFunds() {
    const hasFinalized = await this.hasFinalized();
    const wasMinimumRaiseReached = await this.minimumReached();
    if (hasFinalized && wasMinimumRaiseReached) {
      const balance = await this.getBalance();
      return balance;
    }

    return 0;
  }

  /**
   * @function wereUnsoldTokensReedemed
   * @description Verify if the admin already reemeded unsold tokens
   * @returns {Boolean}
   */
  async wereUnsoldTokensReedemed() {
    try {
      return await this.params.contract
        .getContract()
        .methods.unsoldTokensRedeemed()
        .call();
    } catch (e) {
      console.error(e);
    }
    return await this.params.contract
      .getContract()
      .methods.unsoldTokensReedemed()
      .call();
  }

  /**
   * @function redeemGivenMinimumGoalNotAchieved
   * @variation isStandard
   * @description Reedem Ethereum from sale that did not achieve minimum goal
   * @param {Integer} purchaseId
   */
  redeemGivenMinimumGoalNotAchieved = async ({ purchaseId }) => {
    const methodToExecute =
      this.getContractMethods().redeemGivenMinimumGoalNotAchieved(purchaseId);
    return this.executeContractMethod({ methodToExecute });
  };

  /**
   * @function setIndividualMaximumAmount
   * @type admin
   * @param {Integer} individualMaximumAmount
   * @description Modifies the max allocation
   */
  setIndividualMaximumAmount = async ({ individualMaximumAmount }) => {
    const decimals = await this.getTradingDecimals();
    const maxAmount = Numbers.toSmartContractDecimals(
      individualMaximumAmount,
      decimals
    );
    const methodToExecute =
      this.getContractMethods().setIndividualMaximumAmount(maxAmount);

    return this.executeContractMethod({ methodToExecute });
  };

  /**
   * @function individualMaximumAmount
   * @description Get Individual Maximum Amount for each address
   * @returns {Integer}
   */
  async individualMaximumAmount() {
    const individualMaxAmount = await this.getContractMethods()
      .individualMaximumAmount()
      .call();
    const decimals = await this.getTradingDecimals();

    return Numbers.fromDecimals(individualMaxAmount, decimals);
  }

  /**
   * @function isApproved
   * @description Verify if the Admin has approved the pool to use receive the tokens for sale
   * @param {Integer} tokenAmount
   * @param {Address} address
   * @returns {Boolean}
   */
  isApproved = async ({ tokenAmount, address }) => {
    return await this.getTokenContract().isApproved({
      address,
      amount: tokenAmount,
      spenderAddress: this.getAddress(),
    });
  };

  /**
   * @function isApprovedSwapERC20
   * @param {Integer} tokenAmount
   * @param {Address} address
   * @description Verify if it is approved to invest
   */
  isApprovedSwapERC20 = async ({ tokenAmount, address, callback }) => {
    if (await this.isETHTrade()) {
      throw new Error('Funcion only available to ERC20 Trades');
    }
    return await this.params.erc20TokenContract.isApproved({
      address,
      spenderAddress: this.getAddress(),
      amount: tokenAmount,
      callback,
    });
  };

  /**
   * @function approveSwapERC20
   * @param {Integer} tokenAmount
   * @description Approve the investor to use approved tokens for the sale
   */
  approveSwapERC20 = async ({ tokenAmount, callback }) => {
    if (await this.isETHTrade()) {
      throw new Error('Funcion only available to ERC20 Trades');
    }
    return await this.params.erc20TokenContract.approve({
      address: this.getAddress(),
      amount: tokenAmount,
      callback,
    });
  };

  /**
   * @function getTradingERC20Address
   * @description Get Trading Address if ERC20
   * @returns {Address}
   */
  async getTradingERC20Address() {
    try {
      return await this.params.contract
        .getContract()
        .methods.erc20TradeIn()
        .call();
    } catch (e) {
      // Swap v2
      return '0x0000000000000000000000000000000000000000';
    }
  }

  /**
   * @function isETHTrade
   * @description Verify if Token Sale is against Ethereum
   * @returns {Boolean}
   */
  async isETHTrade() {
    return this.params.contract.getContract().methods.isETHTrade().call();
  }

  /**
   * @function getTradingDecimals
   * @description Get Trading Decimals (18 if isETHTrade, X if not)
   * @returns {Integer}
   */
  async getTradingDecimals() {
    const tradeAddress = await this.getTradingERC20Address();
    if (tradeAddress === '0x0000000000000000000000000000000000000000') {
      return 18;
    }
    const contract = new ERC20TokenContract({
      web3: this.web3,
      contractAddress: tradeAddress,
      acc: this.acc,
    });
    console.log('CONTRACT => ');
    return contract.getDecimals();
  }

  /** ************************************
   * DATE METHODS
   ************************************* */

  /**
   * @function startDate
   * @description Get Start Date of Change
   * @returns {Date}
   */
  async startDate() {
    const contractMethods = await this.getContractMethods();
    const result = (await contractMethods.startDate().call()) as BigNumber;
    const startDate = Numbers.fromSmartContractTimeToMinutes(result.toNumber());

    return startDate;
  }

  /**
   * @function endDate
   * @description Get End Date of Change
   * @returns {Date}
   */
  async endDate() {
    const contractMethods = await this.getContractMethods();
    const result = (await contractMethods.endDate().call()) as BigNumber;
    const endDate = Numbers.fromSmartContractTimeToMinutes(result.toNumber());

    return endDate;
  }

  /**
   * @function setEndDate
   * @type admin
   * @param {Date} endDate
   * @description Modifies the end date for the pool
   */
  setEndDate = async ({ endDate }) => {
    const contractMethods = await this.getContractMethods();
    const input = Numbers.timeToSmartContractTime(endDate);
    const methodToExecute = await contractMethods.setEndDate(input);

    return this.executeContractMethod({ methodToExecute });
  };

  /**
   * @function setStartDate
   * @type admin
   * @param {Date} startDate
   * @description Modifies the start date for the pool
   */
  setStartDate = async ({ startDate }) => {
    const contractMethods = await this.getContractMethods();
    const input = Numbers.timeToSmartContractTime(startDate);
    const methodToExecute = await contractMethods.setStartDate(input);

    return this.executeContractMethod({ methodToExecute });
  };

  /**
   * @function isFinalized
   * @description To see if contract was finalized
   * @returns {Boolean}
   */
  async isFinalized() {
    return (await this.getContractMethods().hasFinalized().call()) as boolean;
  }

  /**
   * @function isOpen
   * @description Verify if the Token Sale is Open for Swap
   * @returns {Boolean}
   */
  async isOpen() {
    return (await this.getContractMethods().isOpen().call()) as boolean;
  }

  /**
   * @function hasStarted
   * @description Verify if the Token Sale has started the Swap
   * @returns {Boolean}
   */
  async hasStarted() {
    return (await this.getContractMethods().hasStarted().call()) as boolean;
  }

  /**
   * @function hasFinalized
   * @description Verify if the Token Sale has finalized, if the current date is after endDate
   * @returns {Boolean}
   */
  async hasFinalized() {
    return (await this.getContractMethods().hasFinalized().call()) as boolean;
  }

  /**
   * @function isPreStart
   * @description Verify if the Token Sale in not open yet
   * @returns {Boolean}
   */
  async isPreStart(): Promise<boolean> {
    return (await this.getContractMethods().isPreStart().call()) as boolean;
  }

  /** ************************************
   * BLACKLIST METHODS
   ************************************* */

  /**
   * @function addToBlacklist
   * @description Adds an address to the blacklist
   * @param {string} address
   */
  addToBlacklist = async ({ address }) => {
    const methodToExecute = this.getContractMethods().addToBlacklist(address);
    try {
      return await this.executeContractMethod({ methodToExecute });
    } catch (err) {
      throw err;
    }
  };

  /**
   * @function removeFromBlacklist
   * @description Removes an address from the blacklist
   * @param {string} address
   */
  removeFromBlacklist = async ({ address }) => {
    const methodToExecute =
      this.getContractMethods().removeFromBlacklist(address);

    try {
      return await this.executeContractMethod({
        methodToExecute,
      });
    } catch (err) {
      throw err;
    }
  };

  /**
   * @function isBlackListed
   * @description Returns true if the address is in the blacklist
   * @param {string} address
   * @returns {boolean} isBlackListed
   */
  isBlacklisted = async ({ address }): Promise<boolean> => {
    return this.getContractMethods().isBlacklisted(address).call();
  };

  /** ************************************
   * PAUSABLE METHODS
   ************************************* */

  /**
   * @function isPaused
   * @description Returns if the contract is paused or not
   * @returns {boolean}
   */

  async isPaused() {
    return (await this.getContractMethods().paused().call()) as boolean;
  }

  /**
   * @function pauseContract
   * @type admin
   * @description Pause Contract
   */
  async pauseContract() {
    const methodToExecute = this.getContractMethods().pause();
    return this.executeContractMethod({ methodToExecute });
  }

  /**
   * @function unpauseContract
   * @type admin
   * @description Unpause Contract
   */
  async unpauseContract() {
    const methodToExecute = this.getContractMethods().unpause();
    return this.executeContractMethod({ methodToExecute });
  }

  /** ************************************
   * UTILS
   ************************************* */

  __assert() {
    this.params.contract.use(this.contractInterface, this.getAddress());
  }

  /**
   * @function getSmartContractVersion
   * @description Returns the version of the smart contract that is currently inside psjs
   * @param {Address} Address
   */
  getSmartContractVersion = async () => {
    return (await this.getContractMethods().getAPIVersion().call()) as string;
  };

  getContractMethods() {
    return this.params.contract.getContract().methods;
  }

  getDecimals = async () => {
    return await this.getTokenContract().getDecimals();
  };

  getAddress() {
    return this.params.contractAddress;
  }

  getTokenAddress() {
    return this.getTokenContract().getAddress();
  }

  getTokenContract() {
    return this.params.erc20TokenContract;
  }

  executeContractMethod = async ({
    methodToExecute,
    call = false,
    value = '0',
    callback,
  }: ExecuteContractMethodArgs) => {
    return this.client.sendTx({
      web3: this.params.web3,
      acc: this.acc,
      contract: this.params.contract,
      f: methodToExecute,
      call,
      value,
      callback,
    });
  };

  assertERC20Info = async () => {
    if (!(await this.isETHTrade())) {
      this.params.erc20TokenContract = new ERC20TokenContract({
        web3: this.web3,
        contractAddress: await this.getTradingERC20Address(),
        acc: this.acc,
      });
    }
  };
}

export default BaseSwapContract;
