/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
/* eslint-disable @typescript-eslint/return-await */
/* eslint-disable no-param-reassign */
import _ from 'lodash';
import { BigNumber } from 'mathjs';
import moment from 'moment';

import { fixednftswap } from '../../interfaces';
import DeploymentService from '../../services/DeploymentService';
import Numbers from '../../utils/Numbers';
import BaseSwapContract from './base/BaseSwapContract';

type SwapArgs = {
  tokenAmount: number;
  categoryId: number;
  maxAllocation: number;
  callback?: (args?: any) => void;
  signature?: string;
};

/**
 * Fixed NFT Swap Object
 * @constructor FixedNFTSwapContract
 * @param {Web3} web3
 * @param {Address} contractAddress ? (opt)
 * @extends BaseSwapContract
 */
class FixedNFTSwapContract extends BaseSwapContract {
  constructor({ web3, contractAddress = null /* If not deployed */, acc }) {
    super({ web3, contractAddress, acc, contractInterface: fixednftswap });
  }

  /**
	 *
	 * @function deploy
	 * @description Deploy the NFT swap contract
	 * @param {String} startDate Start date
	 * @param {String} endDate End date
	 * @param {String} distributionDate Distribution date
	 * @param {Float=} individualMaximumAmount Max cap per wallet. 0 to disable it. (Default: 0)
	 * @param {Float=} minimumRaise Soft cap (Default: 0)
	 * @param {Float=} feePercentage Fee percentage (Default: 1)
	 * @param {Boolean=} hasWhitelisting Has White Listing. (Default: false)
	 * @param {String=} ERC20TradingAddress Token to use in the swap (Default: 0x0000000000000000000000000000000000000000)
	 * @param {Number[]} categoryIds Ids of the NFT categories
	 * @param {Number[]} categoriesSupply Supply of every category of NFT in same order than Ids
	 * @param {Float[]} categoriesPrice Price per unit of a category item, in same order than Ids
	 * @param {Number=} tradingDecimals To be the decimals of the currency in case (ex : USDT -> 9; ETH -> 18) (Default: 0)

	*/

  deploy = async ({
    startDate,
    endDate,
    distributionDate,
    individualMaximumAmount = 0,
    minimumRaise = 0,
    feePercentage = 1,
    hasWhitelisting = false,
    ERC20TradingAddress = '0x0000000000000000000000000000000000000000',
    categoryIds,
    categoriesSupply,
    categoriesPrice,
    tradingDecimals = 0 /* To be the decimals of the currency in case (ex : USDT -> 9; ETH -> 18) */,
    callback = () => {},
  }) => {
    if (feePercentage < 1) {
      throw new Error('Fee Amount has to be >= 1');
    }

    if (
      ERC20TradingAddress !== '0x0000000000000000000000000000000000000000' &&
      !tradingDecimals
    ) {
      throw new Error(
        "If an ERC20 Trading Address please add the 'tradingDecimals' field to the trading address (Ex : USDT -> 6)"
      );
    } else {
      /* is ETH Trade */
      tradingDecimals = 18;
    }

    let totalRaise = 0;

    const finalcategoriesPrice = categoriesSupply.map((supply, index) => {
      totalRaise += categoriesSupply * categoriesPrice[index];

      return Numbers.toSmartContractDecimals(
        categoriesPrice[index],
        tradingDecimals
      );
    });

    if (minimumRaise !== 0 && minimumRaise > totalRaise) {
      throw new Error('Minimum Raise has to be smaller than total Raise');
    }
    if (Date.parse(startDate) >= Date.parse(endDate)) {
      throw new Error('Start Date has to be smaller than End Date');
    }
    if (Date.parse(endDate) >= Date.parse(distributionDate)) {
      throw new Error('End Date has to be smaller than Distribution Date');
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

    if (individualMaximumAmount > 0) {
      /* If exists individualMaximumAmount */
      if (individualMaximumAmount > totalRaise) {
        throw new Error(
          'Individual Maximum Amount should be smaller than total Tokens For Sale'
        );
      }
    }

    if (!individualMaximumAmount) {
      individualMaximumAmount =
        totalRaise; /* Set Max Amount to Unlimited if 0 */
    }

    const params = [
      Numbers.timeToSmartContractTime(startDate),
      Numbers.timeToSmartContractTime(endDate),
      Numbers.timeToSmartContractTime(distributionDate),
      Numbers.toSmartContractDecimals(
        individualMaximumAmount,
        await this.getTradingDecimals()
      ),
      Numbers.toSmartContractDecimals(
        minimumRaise,
        await this.getTradingDecimals()
      ),
      feePercentage,
      hasWhitelisting,
      ERC20TradingAddress,
      categoryIds,
      categoriesSupply,
      finalcategoriesPrice,
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

  /**
   * @function swap
   * @description Swap tokens by Ethereum or ERC20
   * @param {Integer} tokenAmount
   * @param {Integer} categoryId
   * @param {Integer} maxAllocation
   * @param {string=} signature Signature for the offchain whitelist
   */

  swap = async ({
    tokenAmount,
    categoryId,
    maxAllocation,
    callback,
    signature,
  }: SwapArgs) => {
    const cost = await this.getCost({
      amount: tokenAmount,
      categoryId,
    });

    const costToDecimals = Numbers.toSmartContractDecimals(
      cost,
      await this.getTradingDecimals()
    );

    const methodToExecute = this.getContractMethods().swapWithSig(
      tokenAmount,
      categoryId,
      maxAllocation,
      signature || '0x00'
    );

    return this.executeContractMethod({
      methodToExecute,
      call: false,
      value: (await this.isETHTrade()) ? costToDecimals : '0',
      callback,
    });
  };

  /** ************************************
   * DATE METHODS
   ************************************* */

  /**
   * @function setDistributionDate
   * @type admin
   * @param {Date} distributionDate
   * @description Modifies the distribution date for the pool
   */
  setDistributionDate = async ({ distributionDate }) => {
    const contractMethods = await this.getContractMethods();
    const input = Numbers.timeToSmartContractTime(distributionDate);
    const methodToExecute = await contractMethods.setDistributionDate(input);

    return this.executeContractMethod({ methodToExecute });
  };

  /**
   * @function distributionDate
   * @description Get Distribution Date of NFT
   * @returns {Date}
   */
  async distributionDate() {
    const contractMethods = await this.getContractMethods();
    const result = (await contractMethods
      .distributionDate()
      .call()) as BigNumber;

    const distributionDate = Numbers.fromSmartContractTimeToMinutes(
      result.toNumber()
    );

    return distributionDate;
  }

  /**
   * @function hasDistributed
   * @description Verify if the NFTs are up for distribution, if the current date is after distributionDate
   * @returns {Boolean}
   */
  async hasDistributed() {
    return (await this.params.contract
      .getContract()
      .methods.hasDistributed()
      .call()) as boolean;
  }

  /** ************************************
   * TOKEN METHODS
   ************************************* */

  /**
   * @function tokensForSale
   * @description Get Total tokens for sale by category
   * @param {Integer} categoryId
   * @returns {Integer} Amount in Tokens
   */
  async tokensForSale({ categoryId }) {
    return (
      await this.params.contract
        .getContract()
        .methods.categories(categoryId)
        .call()
    ).supply;
  }

  /**
   * @function soldByCategoryId
   * @description Get Total tokens for sold by category
   * @param {Integer} categoryId
   * @returns {Integer} Amount in Tokens
   */
  async soldByCategoryId({ categoryId }) {
    return (await this.getContractMethods()
      .soldByCategoryId(categoryId)
      .call()) as BigNumber;
  }

  /**
   * @function tokensLeft
   * @description Get Total tokens owned by category
   * @param {Integer} categoryId
   * @returns {Integer} Amount in Tokens
   */
  async tokensLeft({ categoryId }: { categoryId: number }) {
    return (await this.getContractMethods()
      .tokensLeft(categoryId)
      .call()) as BigNumber;
  }

  /**
   * @function totalCost
   * @description Get Total cost for buying all the nfts
   * @returns {Integer} Amount in Tokens
   */
  async totalCost() {
    return await this.getContractMethods().maximumRaise().call();
  }

  /**
   * @function getCost
   * @description Get Cost for category and amount
   * @param {Integer} amount
   * @param {Integer} categoryId
   * @returns {Integer} costAmount
   */
  getCost = async ({ amount, categoryId }) => {
    return Numbers.fromDecimals(
      await this.params.contract
        .getContract()
        .methods.cost(amount, categoryId)
        .call(),
      await this.getTradingDecimals()
    );
  };

  /**
   * @function safePullTradeToken
   * @description Safe Pull all trading tokens
   */
  safePullTradeToken = async () => {
    return this.executeContractMethod({
      methodToExecute: this.getContractMethods().safePullTradeToken(),
      value: '0',
    });
  };

  /* Legacy Call */
  getETHCostFromTokens = () => {
    throw new Error("Please use 'getCost' instead");
  };

  /** ************************************
   * PURCHASE METHODS
   ************************************* */

  /**
   * @function getUserPurchases
   * @param {Address} address
   * @returns {Object[]} purchases
   */
  getUserPurchases = async ({ address }): Promise<any[]> => {
    const purchaseIds = await this.params.contract
      .getContract()
      .methods.getMyPurchases(address)
      .call();
    const purchases = [];

    for (const id of purchaseIds) {
      if (id !== undefined) {
        const purchase = await this.getPurchase({ purchaseId: Number(id) });
        purchases.push(purchase);
      }
    }
    return purchases;
  };

  /**
   * @function getPurchase
   * @description Get Purchase based on ID
   * @param {Integer} purchaseId
   * @returns {Integer} _id
   * @returns {Integer} categoryId
   * @returns {Integer} amount
   * @returns {Integer} amountContributed
   * @returns {Address} purchaser
   * @returns {Date} timestamp
   * @returns {Boolean} reverted
   */
  getPurchase = async ({ purchaseId }) => {
    const res = await this.getContractMethods().getPurchase(purchaseId).call();

    const decimals = await this.getTradingDecimals();
    const amountContributed = Numbers.fromDecimals(
      res.amountContributed,
      decimals
    );

    return {
      _id: purchaseId,
      categoryId: Number(res.categoryId),
      amount: Number(res.amountPurchased),
      amountContributed,
      purchaser: res.purchaser,
      timestamp: Numbers.fromSmartContractTimeToMinutes(res.timestamp),
      reverted: res.reverted,
    };
  };

  /**
   * @function getBuyers
   * @description Get Buyers
   * @returns {Array | Integer} _ids
   */

  getBuyers = async () =>
    (await this.getContractMethods().getBuyers().call()) as number[];

  /**
   * @function getPurchaseIds
   * @description Get All Purchase Ids
   * @returns {(Array | Integer)} _ids
   */
  getPurchaseIds = async () => {
    const res = (await this.getContractMethods()
      .getPurchasesCount()
      .call()) as number;

    const ids = Array.from(Array(res).keys());

    return ids;
  };

  /**
   * @function getPurchaseIds
   * @description Get All Purchase Ids filter by Address/Purchaser
   * @param {Address} address
   * @returns {Array | Integer} _ids
   */
  getAddressPurchaseIds = async ({ address }) => {
    const res = (await this.executeContractMethod({
      methodToExecute: this.getContractMethods().getMyPurchases(address),
      call: true,
    })) as number[];
    return res.map((id) => Numbers.fromHex(id));
  };

  /** ************************************
   * CATEGORIES METHODS
   ************************************* */

  /**
   * @function getIsClaimedCategoryForUser
   * @param {Address} address
   * @param {Number} categoryId
   * @returns {boolean} claimed
   */
  getIsClaimedCategoryForUser = async ({ address, categoryId }) => {
    const methodToExecute =
      this.getContractMethods().getIsClaimedCategoryForUser(
        address,
        categoryId
      );
    return this.executeContractMethod({
      methodToExecute,
      call: true,
    }) as Promise<boolean>;
  };

  /**
   * @function setUserClaimedCategory
   * @type admin
   * @param {Address} address
   * @param {Number} categoryId
   * @description Sets user claimed category
   */
  setUserClaimedCategory = async ({ address, categoryId }) => {
    await this.executeContractMethod(
      this.getContractMethods().setUserClaimedCategory(address, categoryId)
    );
  };

  /**
   * @function categoryIds
   * @returns {Number[]} an array containig all category ids
   */
  async categoryIds() {
    return (await this.getContractMethods()
      .getCategoryIds()
      .call()) as BigNumber[];
  }

  /**
   * @function setCategories
   * @type admin
   * @param {Number[]} categoryIds Ids of the NFT categories
   * @param {Number[]} categoriesSupply Supply of every category of NFT in same order than Ids
   * @param {Float[]} categoriesPrice Price per unit of a category item, in same order than Ids
   * @param {Number} tradingDecimals To be the decimals of the currency in case (ex : USDT -> 9; ETH -> 18)
   * @description Modifies the categories oon the contract
   */
  setCategories = async ({
    categoryIds,
    categoriesSupply,
    categoriesPrice,
  }) => {
    const finalcategoriesPrice = [];

    categoriesPrice.map(async (categoryPrice, index) => {
      finalcategoriesPrice[index] = Numbers.toSmartContractDecimals(
        categoryPrice,
        await this.getTradingDecimals()
      );
    });

    return this.executeContractMethod(
      this.getContractMethods().setCategories(
        categoryIds,
        categoriesSupply,
        categoriesPrice
      )
    );
  };
}

export default FixedNFTSwapContract;
