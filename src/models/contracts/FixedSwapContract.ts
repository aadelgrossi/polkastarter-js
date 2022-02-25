/* eslint-disable block-scoped-var */
/* eslint-disable vars-on-top */
/* eslint-disable no-plusplus */
/* eslint-disable no-await-in-loop */
/* eslint-disable radix */
/* eslint-disable @typescript-eslint/return-await */
/* eslint-disable no-bitwise */
/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable no-param-reassign */
/* eslint-disable no-useless-catch */
import { Decimal } from 'decimal.js';
import * as ethers from 'ethers';
import _ from 'lodash';
import moment from 'moment';

import { fixedswap } from '../../interfaces';
import DeploymentService from '../../services/DeploymentService';
import Client from '../../utils/Client';
import Numbers from '../../utils/Numbers';
import Contract from '../base/Contract';
import ERC20TokenContract from '../base/ERC20TokenContract';
import BaseSwapContract from './base/BaseSwapContract';
import IDOStaking from './IDOStaking';

const RESIDUAL_ETH = 0.00001;

/**
 * Fixed Swap Object
 * @constructor FixedSwapContract
 * @param {Web3} web3
 * @param {Address} tokenAddress
 * @param {Address} contractAddress ? (opt)
 * @extends BaseSwapContract
 */
class FixedSwapContract extends BaseSwapContract {
  constructor({
    web3,
    tokenAddress,
    contractAddress = null /* If not deployed */,
    acc,
  }) {
    super({ web3, contractAddress, acc, contractInterface: fixedswap });
    try {
      if (tokenAddress) {
        this.params.erc20TokenContract = new ERC20TokenContract({
          web3,
          contractAddress: tokenAddress,
          acc,
        });
      } else if (!contractAddress) {
        throw new Error('Please provide a contractAddress if already deployed');
      }
    } catch (err) {
      throw err;
    }
  }

  /**
   * @function deploy
   * @description Deploy the Pool Contract
   * @param {Float} tradeValue Buy price
   * @param {Float} tokensForSale Tokens for sale
   * @param {String} endDate End date
   * @param {String} startDate Start date
   * @param {String=} ERC20TradingAddress Token to use in the swap (Default: 0x0000000000000000000000000000000000000000)
   * @param {Float=} individualMinimumAmount Min cap per wallet. 0 to disable it. (Default: 0)
   * @param {Float=} individualMaximumAmount Max cap per wallet. 0 to disable it. (Default: 0)
   * @param {Boolean=} isTokenSwapAtomic Receive tokens right after the swap. (Default: false)
   * @param {Float=} minimumRaise Soft cap (Default: 0)
   * @param {Float=} feeAmount Fee amount (Default: 1)
   * @param {Number=} tradingDecimals To be the decimals of the currency in case (ex : USDT -> 9; ETH -> 18) (Default: 0)
   * @param {Boolean=} hasWhitelisting Has White Listing. (Default: false)
   * @param {Boolean=} isPOLSWhitelist Has White Listing. (Default: false)
   * @param {Array<Integer>=} vestingSchedule Vesting schedule in %
   * @param {String=} vestingStart Vesting start date (Default: endDate)
   * @param {Number=} vestingCliff Seconds to wait for the first unlock after the vesting start (Default: 0)
   * @param {Number=} vestingDuration Seconds to wait between every unlock (Default: 0)
   */
  deploy = async ({
    tradeValue,
    tokensForSale,
    startDate,
    endDate,
    individualMinimumAmount = 0,
    individualMaximumAmount = 0,
    isTokenSwapAtomic = false,
    minimumRaise = 0,
    feeAmount = 1,
    hasWhitelisting = false,
    callback = () => {},
    ERC20TradingAddress = '0x0000000000000000000000000000000000000000',
    isPOLSWhitelist = false,
    tradingDecimals = 0 /* To be the decimals of the currency in case (ex : USDT -> 9; ETH -> 18) */,
    vestingSchedule = [],
    vestingStart = null,
    vestingCliff = 0,
    vestingDuration = 0,
  }) => {
    if (_.isEmpty(this.getTokenAddress())) {
      throw new Error('Token Address not provided');
    }

    if (tradeValue <= 0) {
      throw new Error('Trade Value has to be > 0');
    }
    if (tokensForSale <= 0) {
      throw new Error('Tokens for Sale has to be > 0');
    }
    if (feeAmount < 1) {
      throw new Error('Fee Amount has to be >= 1');
    }
    if (minimumRaise !== 0 && minimumRaise > tokensForSale) {
      throw new Error('Minimum Raise has to be smaller than total Raise');
    }
    if (Date.parse(startDate) >= Date.parse(endDate)) {
      throw new Error('Start Date has to be smaller than End Date');
    }
    if (
      Date.parse(startDate) <=
      Date.parse(moment(Date.now()).add(2, 'm').toString())
    ) {
      throw new Error(
        'Start Date has to be higher (at least 2 minutes) than now'
      );
    }
    if (individualMaximumAmount < 0) {
      throw new Error('Individual Maximum Amount should be bigger than 0');
    }
    if (individualMinimumAmount < 0) {
      throw new Error('Individual Minimum Amount should be bigger than 0');
    }

    if (individualMaximumAmount > 0) {
      /* If exists individualMaximumAmount */
      if (individualMaximumAmount <= individualMinimumAmount) {
        throw new Error(
          'Individual Maximum Amount should be bigger than Individual Minimum Amount'
        );
      }
      if (individualMaximumAmount > tokensForSale) {
        throw new Error(
          'Individual Maximum Amount should be smaller than total Tokens For Sale'
        );
      }
    }

    if (
      ERC20TradingAddress !== '0x0000000000000000000000000000000000000000' &&
      tradingDecimals === 0
    ) {
      throw new Error(
        "If an ERC20 Trading Address please add the 'tradingDecimals' field to the trading address (Ex : USDT -> 6)"
      );
    } else {
      /* is ETH Trade */
      tradingDecimals = 18;
    }

    if (individualMaximumAmount === 0) {
      individualMaximumAmount =
        tokensForSale; /* Set Max Amount to Unlimited if 0 */
    }

    if (
      vestingSchedule.length > 0 &&
      vestingSchedule.reduce((a, b) => a + b, 0) !== 100
    ) {
      throw new Error("'vestingSchedule' sum has to be equal to 100");
    }

    const DECIMALS_PERCENT_MUL = 10 ** 12;
    vestingSchedule = vestingSchedule.map((a) =>
      String(new Decimal(a).mul(DECIMALS_PERCENT_MUL)).toString()
    );

    const FLAG_isTokenSwapAtomic = 1; // Bit 0
    const FLAG_hasWhitelisting = 2; // Bit 1
    const FLAG_isPOLSWhitelisted = 4; // Bit 2 - true => user must have a certain amount of POLS staked to participate

    if (vestingSchedule.length === 0) {
      vestingCliff = 0;
    }
    if (!vestingStart) {
      vestingStart = endDate;
    }

    const params = [
      this.getTokenAddress(),
      Numbers.toSmartContractDecimals(tradeValue, tradingDecimals),
      Numbers.toSmartContractDecimals(tokensForSale, await this.getDecimals()),
      Numbers.timeToSmartContractTime(startDate),
      Numbers.timeToSmartContractTime(endDate),
      Numbers.toSmartContractDecimals(
        individualMinimumAmount,
        await this.getDecimals()
      ),
      Numbers.toSmartContractDecimals(
        individualMaximumAmount,
        await this.getDecimals()
      ),
      true, // ignored
      Numbers.toSmartContractDecimals(minimumRaise, await this.getDecimals()),
      parseInt(feeAmount.toString(), 10),
      (isTokenSwapAtomic ? FLAG_isTokenSwapAtomic : 0) |
        (hasWhitelisting ? FLAG_hasWhitelisting : 0) |
        (isPOLSWhitelist ? FLAG_isPOLSWhitelisted : 0), // Flags
      ERC20TradingAddress,
      Numbers.timeToSmartContractTime(vestingStart),
      vestingCliff,
      vestingDuration,
      vestingSchedule,
    ];

    const res = await new DeploymentService().deploy(
      this.acc,
      this.params.contract,
      params,
      callback
    );
    this.params.contractAddress = res.contractAddress;
    /* Call to Backend API */

    this.__assert();
    return res;
  };

  assertERC20Info = async () => {
    const tokenAddress = await this.erc20();
    this.params.erc20TokenContract = new ERC20TokenContract({
      web3: this.web3,
      contractAddress: tokenAddress,
      acc: this.acc,
    });
    if (!(await this.isETHTrade())) {
      this.params.tradingERC20Contract = new ERC20TokenContract({
        web3: this.web3,
        contractAddress: await this.getTradingERC20Address(),
        acc: this.acc,
      });
    }
  };

  /**
   * @function setStakingRewards
   * @type admin
   * @description Sets the staking rewards address
   * @param {string} address
   */
  async setStakingRewards({ address }) {
    await this.executeContractMethod(
      this.getContractMethods().setStakingRewards(address)
    );
    return true;
  }

  /**
   * @function getIDOStaking
   * @description Returns the contract for the ido staking
   * @returns {IDOStaking}
   */
  async getIDOStaking() {
    const contractAddr = await this.getContractMethods()
      .stakingRewardsAddress()
      .call();
    if (contractAddr === '0x0000000000000000000000000000000000000000') {
      return null;
    }
    return new IDOStaking({
      acc: this.acc,
      web3: this.web3,
      contractAddress: contractAddr,
    });
  }

  /**
   * @function erc20
   * @description Get Token Address
   * @returns {Address} Token Address
   */
  async erc20() {
    return await this.params.contract.getContract().methods.erc20().call();
  }

  /* Get Functions */
  /**
   * @function tradeValue
   * @description Get swapratio for the pool
   * @returns {Integer} trade value against ETH
   */
  async tradeValue() {
    return Numbers.fromDecimals(
      await this.params.contract.getContract().methods.tradeValue().call(),
      await this.getTradingDecimals()
    );
  }

  /**
   * @function vestingStart
   * @description Get Start Date of the Vesting
   * @returns {Date}
   */
  async vestingStart() {
    try {
      return Numbers.fromSmartContractTimeToMinutes(
        await this.getContractMethods().vestingStart().call()
      );
    } catch (e) {
      // Swap v2
      return this.endDate();
    }
  }

  /**
   * @function individualMinimumAmount
   * @description Get Individual Minimum Amount for each address
   * @returns {Integer}
   */
  async individualMinimumAmount() {
    return Numbers.fromDecimals(
      await this.params.contract
        .getContract()
        .methods.individualMinimumAmount()
        .call(),
      await this.getDecimals()
    );
  }

  /**
   * @function tokensForSale
   * @description Get Total tokens Allocated/In Sale for the Pool
   * @returns {Integer} Amount in Tokens
   */
  async tokensForSale() {
    return Numbers.fromDecimals(
      await this.params.contract.getContract().methods.tokensForSale().call(),
      await this.getDecimals()
    );
  }

  /**
   * @function tokensAvailable
   * @description Get Total tokens owned by the Pool
   * @returns {Integer} Amount in Tokens
   */
  async tokensAvailable() {
    return Numbers.fromDecimals(
      await this.params.contract.getContract().methods.availableTokens().call(),
      await this.getDecimals()
    );
  }

  /**
   * @function tokensLeft
   * @description Get Total tokens available to be sold in the pool
   * @returns {Integer} Amount in Tokens
   */
  async tokensLeft() {
    return Numbers.fromDecimals(
      await this.params.contract.getContract().methods.tokensLeft().call(),
      await this.getDecimals()
    );
  }

  /**
   * @function individualMaximumAmount
   * @description Get Individual Maximum Amount for each address
   * @returns {Integer}
   */
  async individualMaximumAmount() {
    return Numbers.fromDecimals(
      await this.params.contract
        .getContract()
        .methods.individualMaximumAmount()
        .call(),
      await this.getDecimals()
    );
  }

  /**
   * @function withdrawableUnsoldTokens
   * @description Get Total tokens available to be withdrawn by the admin
   * @returns {Integer} Amount in Tokens
   */
  async withdrawableUnsoldTokens() {
    let res = 0;
    if (
      (await this.hasFinalized()) &&
      !(await this.wereUnsoldTokensReedemed())
    ) {
      if (await this.minimumReached()) {
        /* Minimum reached */
        const tokensForSale = (await this.tokensForSale()) as number;
        const tokensAllocated = (await this.tokensAllocated()) as number;

        res = tokensForSale - tokensAllocated;
      } else {
        /* Minimum reached */
        res = (await this.tokensForSale()) as number;
      }
    }
    return res;
  }

  /**
   * @function isTokenSwapAtomic
   * @description Verify if the Token Swap is atomic on this pool
   * @returns {Boolean}
   */
  async isTokenSwapAtomic() {
    return await this.params.contract
      .getContract()
      .methods.isTokenSwapAtomic()
      .call();
  }

  /**
   * @function isFunded
   * @description Verify if the Token Sale is Funded with all Tokens proposed in tokensForSale
   * @returns {Boolean}
   */
  async isFunded() {
    return await this.params.contract
      .getContract()
      .methods.isSaleFunded()
      .call();
  }

  /**
   * @function isPOLSWhitelisted
   * @description Verify if Token Sale is POLS Whitelisted
   * @returns {Boolean}
   */
  async isPOLSWhitelisted() {
    return await this.params.contract
      .getContract()
      .methods.isPOLSWhitelisted()
      .call();
  }

  /**
   * @function isAddressPOLSWhitelisted
   * @description Verify if Address is Whitelisted by POLS (returns false if not needed)
   * @returns {Boolean}
   */
  async isAddressPOLSWhitelisted() {
    return await this.params.contract
      .getContract()
      .methods.isAddressPOLSWhitelisted()
      .call();
  }

  /**
   * @function getCurrentSchedule
   * @description Gets Current Schedule
   * @returns {Integer}
   */
  async getCurrentSchedule() {
    return parseInt(
      await this.params.contract
        .getContract()
        .methods.getCurrentSchedule()
        .call(),
      10
    );
  }

  /**
   * @function getVestingSchedule
   * @description Gets Vesting Schedule
   * @param {Integer} Position Get Position of Integer
   * @returns {Array | Integer}
   */
  async getVestingSchedule({ position }) {
    return parseInt(
      await this.params.contract
        .getContract()
        .methods.vestingSchedule(position)
        .call()
    );
  }

  /**
   * @function getPurchase
   * @description Get Purchase based on ID
   * @param {Integer} purchase_id
   * @returns {Integer} _id
   * @returns {Integer} amount
   * @returns {Address} purchaser
   * @returns {Integer} costAmount
   * @returns {Date} timestamp
   * @returns {Integer} amountReedemed
   * @returns {Boolean} wasFinalized
   * @returns {Boolean} reverted
   */

  getPurchase = async ({ purchase_id }) => {
    let res = await this.params.contract
      .getContract()
      .methods.getPurchase(purchase_id)
      .call();
    let amount = Numbers.fromDecimals(res.amount, await this.getDecimals());
    let costAmount = Numbers.fromDecimals(
      res.costAmount,
      await this.getTradingDecimals()
    );
    let amountReedemed = Numbers.fromDecimals(
      res.amountRedeemed,
      await this.getDecimals()
    );
    let amountLeftToRedeem = amount - amountReedemed;

    const isFinalized = await this.hasFinalized();
    let amountToReedemNow = 0;
    try {
      amountToReedemNow = isFinalized
        ? Numbers.fromDecimals(
            (
              await this.params.contract
                .getContract()
                .methods.getRedeemableTokensAmount(purchase_id)
                .call()
            ).amount,
            await this.getDecimals()
          )
        : 0;
    } catch (e) {
      // Swap v2
      const abi = JSON.parse(
        '[{ "inputs": [ { "internalType": "uint256", "name": "purchase_id", "type": "uint256" } ], "name": "getPurchase", "outputs": [ { "name": "", "type": "uint256" }, { "name": "", "type": "address" }, { "name": "", "type": "uint256" }, { "name": "", "type": "uint256" }, { "name": "", "type": "uint256" }, { "name": "", "type": "uint256" }, { "name": "", "type": "bool" }, { "name": "", "type": "bool" } ], "stateMutability": "view", "type": "function" }]'
      );
      const contract = new Contract(
        this.web3,
        { abi },
        this.params.contractAddress
      );
      res = await contract
        .getContract()
        .methods.getPurchase(purchase_id)
        .call();

      let lastTrancheSent = parseInt(res[5]);
      amount = Numbers.fromDecimals(res[0], await this.getDecimals());
      costAmount = Numbers.fromDecimals(
        res[2],
        await this.getTradingDecimals()
      );
      amountReedemed = Numbers.fromDecimals(res[4], await this.getDecimals());
      amountLeftToRedeem = amount - amountReedemed;

      const currentSchedule = await this.getCurrentSchedule();
      lastTrancheSent = parseInt(res[5]);
      for (let i = lastTrancheSent + 1; i <= currentSchedule; i++) {
        amountToReedemNow +=
          (amount * (await this.getVestingSchedule({ position: i }))) / 10000;
      }
      return {
        _id: purchase_id,
        amount,
        purchaser: res[1],
        costAmount,
        timestamp: Numbers.fromSmartContractTimeToMinutes(res[3]),
        amountReedemed,
        amountLeftToRedeem,
        amountToReedemNow: isFinalized ? amountToReedemNow : 0,
        lastTrancheSent,
        wasFinalized: res[6],
        reverted: res[7],
      };
    }

    // ToDo add a test for amountToReedemNow
    return {
      _id: purchase_id,
      amount,
      purchaser: res.purchaser,
      costAmount,
      timestamp: Numbers.fromSmartContractTimeToMinutes(res.timestamp),
      amountReedemed,
      amountLeftToRedeem,
      amountToReedemNow,
      wasFinalized: res.wasFinalized,
      reverted: res.reverted,
    };
  };

  /**
   * @function getWhiteListedAddresses
   * @description Get Whitelisted Addresses
   * @returns {Array | Address} addresses
   */

  getWhitelistedAddresses = async () =>
    await this.getContractMethods().getWhitelistedAddresses().call();

  /**
   * @function getBuyers
   * @description Get Buyers
   * @returns {Array | Integer} _ids
   */

  getBuyers = async () => await this.getContractMethods().getBuyers().call();

  /**
   * @function getPurchaseIds
   * @description Get All Purchase Ids
   * @returns {(Array | Integer)} _ids
   */
  getPurchaseIds = async () => {
    try {
      const res = await this.params.contract
        .getContract()
        .methods.getPurchasesCount()
        .call();
      const ids = [];
      for (let i = 0; i < res; i++) {
        ids.push(i);
      }
      return ids;
    } catch (e) {
      // Swap v2
      // ToDo Refactor
      const abi = JSON.parse(
        '[{ "constant": true, "inputs": [], "name": "getPurchaseIds", "outputs": [ { "name": "", "type": "uint256[]" } ], "payable": false, "stateMutability": "view", "type": "function" }]'
      );
      const contract = new Contract(
        this.web3,
        { abi },
        this.params.contractAddress
      );
      const res = await contract.getContract().methods.getPurchaseIds().call();
      return res.map((id) => Numbers.fromHex(id));
    }
  };

  /**
   * @function getPurchaseIds
   * @description Get All Purchase Ids filter by Address/Purchaser
   * @param {Address} address
   * @returns {Array | Integer} _ids
   */
  getAddressPurchaseIds = async ({ address }) => {
    const methodToExecute = this.getContractMethods().getMyPurchases(address);
    const purchaseIds = await this.executeContractMethod({
      methodToExecute,
      call: true,
    });

    return (purchaseIds as number[]).map((id) => Numbers.fromHex(id));
  };

  /**
   * @function getCostFromTokens
   * @description Get Cost from Tokens Amount
   * @param {Integer} tokenAmount
   * @returns {Integer} costAmount
   */
  getCostFromTokens = async ({ tokenAmount }) => {
    const amountWithDecimals = Numbers.toSmartContractDecimals(
      tokenAmount,
      await this.getDecimals()
    );

    return Numbers.fromDecimals(
      await this.params.contract
        .getContract()
        .methods.cost(amountWithDecimals)
        .call(),
      await this.getTradingDecimals()
    );
  };

  /**
   * @function getDistributionInformation
   * @description Get Distribution Information
   * @returns {Integer} currentSchedule (Ex : 1)
   * @returns {Integer} vestingTime (Ex : 1)
   * @returns {Array | Integer} vestingSchedule (Ex : [100])
   * @returns {Date} vestingStart
   */
  getDistributionInformation = async () => {
    let currentSchedule = 0;
    if (await this.hasStarted()) {
      currentSchedule = await this.getCurrentSchedule();
    }
    const vestingTime = (await this.getContractMethods()
      .vestingTime()
      .call()) as number;
    let legacy = false;
    try {
      await this.getSmartContractVersion();
    } catch (e) {
      legacy = true;
    }

    const vestingSchedule = [];

    if (legacy) {
      for (let i = 1; i <= vestingTime; i++) {
        const a = await this.getVestingSchedule({ position: i });
        vestingSchedule.push(a);
      }
    } else {
      for (let i = 1; i < vestingTime; i++) {
        const a = await this.getVestingSchedule({ position: i - 1 });
        vestingSchedule.push(a);
      }
    }

    const vestingStart = await this.vestingStart();

    return {
      currentSchedule,
      vestingTime,
      vestingSchedule,
      vestingStart,
    };
  };

  /* Legacy Call */
  getETHCostFromTokens = () => {
    throw new Error("Please use 'getCostFromTokens' instead");
  };

  /* POST User Functions */

  /**
   * @function swapWithSig
   * @description Swap tokens by Ethereum or ERC20
   * @param {Integer} tokenAmount
   * @param {string} accountMaxAmount Max alloc in wei
   * @param {string=} signature Signature for the offchain whitelist
   */
  swapWithSig = async ({
    tokenAmount,
    callback,
    signature,
    accountMaxAmount,
  }) => {
    const amountWithDecimals = Numbers.toSmartContractDecimals(
      tokenAmount,
      await this.getDecimals()
    );

    const cost = await this.getCostFromTokens({
      tokenAmount,
    });

    const costToDecimals = Numbers.toSmartContractDecimals(
      cost,
      await this.getTradingDecimals()
    );
    const methodToExecute = this.getContractMethods().swapWithSig(
      amountWithDecimals,
      accountMaxAmount,
      signature
    );

    const value = (await this.isETHTrade()) ? costToDecimals : '0';

    return this.executeContractMethod({
      methodToExecute,
      call: false,
      value,
      callback,
    });
  };

  /**
   * @function swap
   * @description Swap tokens by Ethereum or ERC20
   * @param {Integer} tokenAmount
   * @param {string=} signature Signature for the offchain whitelist
   */
  swap = async ({ tokenAmount, callback = () => {}, signature = null }) => {
    const amountWithDecimals = Numbers.toSmartContractDecimals(
      tokenAmount,
      await this.getDecimals()
    );

    const cost = await this.getCostFromTokens({
      tokenAmount,
    });

    const costToDecimals = Numbers.toSmartContractDecimals(
      cost,
      await this.getTradingDecimals()
    );

    if (!signature) {
      signature = '0x00';
    }

    const methodToExecute = this.getContractMethods().swap(
      amountWithDecimals,
      signature
    );
    const value = (await this.isETHTrade()) ? costToDecimals : '0';

    return this.executeContractMethod({
      methodToExecute,
      call: false,
      value,
      callback,
    });
  };

  __oldSwap = async ({ tokenAmount, callback }) => {
    console.log('swap (tokens Amount)', tokenAmount);
    const amountWithDecimals = Numbers.toSmartContractDecimals(
      tokenAmount,
      await this.getDecimals()
    );

    const cost = await this.getCostFromTokens({
      tokenAmount,
    });
    console.log('cost in ETH (after getCostFromTokens) ', cost);

    const costToDecimals = Numbers.toSmartContractDecimals(
      cost,
      await this.getTradingDecimals()
    );

    console.log('swap (amount in decimals) ', amountWithDecimals);
    console.log('cost (amount in decimals) ', costToDecimals);

    const abi = JSON.parse(
      '[{ "constant": false, "inputs": [ { "name": "_amount", "type": "uint256" } ], "name": "swap", "outputs": [], "payable": true, "stateMutability": "payable", "type": "function" }]'
    );
    const contract = new Contract(
      this.web3,
      { abi },
      this.params.contractAddress
    );

    const methodToExecute = contract
      .getContract()
      .methods.swap(amountWithDecimals);
    const value = (await this.isETHTrade()) ? costToDecimals : '';

    return this.executeContractMethod({
      methodToExecute,
      call: false,
      value,
      callback,
    });
  };

  /**
   * @function redeemTokens
   * @variation isStandard
   * @description Reedem tokens bought
   * @param {Integer} purchase_id
   * @param {Boolean=} stake If true send token to the ido staking contract
   */
  redeemTokens = async ({ purchase_id, stake = false }) => {
    let legacy = false;
    try {
      await this.getSmartContractVersion();
    } catch (e) {
      legacy = true;
    }
    if (legacy) {
      // Swap v2
      const abi = JSON.parse(
        '[{ "constant": false, "inputs": [ { "name": "purchase_id", "type": "uint256" } ], "name": "redeemTokens", "outputs": [], "payable": false, "stateMutability": "nonpayable", "type": "function" }]'
      );
      const contract = new Contract(
        this.web3,
        { abi },
        this.params.contractAddress
      );
      return this.executeContractMethod(
        contract.getContract().methods.redeemTokens(purchase_id)
      );
    }
    return this.executeContractMethod(
      this.getContractMethods().transferTokens(purchase_id, stake)
    );
  };

  /**
   * @function withdrawUnsoldTokens
   * @description Withdraw unsold tokens of sale
   */

  withdrawUnsoldTokens = async () => {
    return this.executeContractMethod(
      this.getContractMethods().withdrawUnsoldTokens()
    );
  };

  /**
   * @function approveFundERC20
   * @param {Integer} tokenAmount
   * @description Approve the pool to use approved tokens for sale
   */
  approveFundERC20 = async ({ tokenAmount, callback = () => {} }) => {
    return await this.getTokenContract().approve({
      address: this.getAddress(),
      amount: tokenAmount,
      callback,
    });
  };

  /**
   * @function setVesting
   * @type admin
   * @param {Array<Integer>=} vestingSchedule Vesting schedule in %
   * @param {String=} vestingStart Vesting start date (Default: endDate)
   * @param {Number=} vestingCliff Seconds between every vesting schedule (Default: 0)
   * @param {Number=} vestingDuration Vesting duration (Default: 0)
   * @description Modifies the current vesting config
   */
  setVesting = async ({
    vestingSchedule = [],
    vestingStart,
    vestingCliff = 0,
    vestingDuration = 0,
  }) => {
    if (
      vestingSchedule.length > 0 &&
      vestingSchedule.reduce((a, b) => a + b, 0) !== 100
    ) {
      throw new Error("'vestingSchedule' sum has to be equal to 100");
    }

    const DECIMALS_PERCENT_MUL = 10 ** 12;
    vestingSchedule = vestingSchedule.map((a) =>
      String(new Decimal(a).mul(DECIMALS_PERCENT_MUL)).toString()
    );

    return this.executeContractMethod(
      this.getContractMethods().setVesting(
        Numbers.timeToSmartContractTime(vestingStart),
        vestingCliff,
        vestingDuration,
        vestingSchedule
      )
    );
  };

  /**
   * @function fund
   * @description Send tokens to pool for sale, fund the sale
   * @param {Integer} tokenAmount
   */
  fund = async ({ tokenAmount, callback = () => {} }) => {
    const amountWithDecimals = Numbers.toSmartContractDecimals(
      tokenAmount,
      await this.getDecimals()
    );

    const methodToExecute = this.getContractMethods().fund(amountWithDecimals);

    return this.executeContractMethod({ methodToExecute, callback });
  };
}

export default FixedSwapContract;
