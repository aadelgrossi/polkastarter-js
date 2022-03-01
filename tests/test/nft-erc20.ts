import { FixedNFTSwapContract } from '@contracts';
import { ierc20 } from '@interfaces';
import { Contract } from '@models';
import { mochaAsync } from '@test-utils';
import chai from 'chai';
import * as ethers from 'ethers';
import ganache from 'ganache-core';
import moment from 'moment';
import Web3 from 'web3';

import { Application } from '../../src';
import { SupportedNetworks } from '../../src/constants/networks';

require('dotenv').config();

// const ERC20TokenAddress = '0x7a7748bd6f9bac76c2f3fcb29723227e3376cbb2';
let contractAddress = '0x420751cdeb28679d8e336f2b4d1fc61df7439b5a';
const contractAddressWithMinimumRaise =
  '0x420751cdeb28679d8e336f2b4d1fc61df7439b5a';
const userPrivateKey =
  '0x7f76de05082c4d578219ca35a905f8debe922f1f00b99315ebf0706afc97f132';
const { expect } = chai;
const tokenPurchaseAmount = 0.01;
const tokenFundAmount = 5;
const tradeValue = 0.01;

context('NFT ERC20 Contract', () => {
  let ERC20TokenAddress;
  let swapContract: FixedNFTSwapContract;
  let app: Application;
  let ethersProvider: ethers.ethers.providers.Web3Provider;
  let isFunded;
  let isSaleOpen;
  let tokensLeft: number;
  let indiviMinAmount;
  let indivMaxAmount;
  let cost;
  let tokensAvailable;
  let _currentTime;

  const isRealChain = process.env.CHAIN_NAME;

  const getWeb3 = () => {
    // Instance Application using ganache
    const provider = ganache.provider({
      gasLimit: 10000000000,
      gasPrice: '1',
      debug: true,
      accounts: [
        {
          secretKey: userPrivateKey,
          balance: 1000000000000000000000,
        },
      ],
    });
    ethersProvider = new ethers.providers.Web3Provider(provider);
    return new Web3(<any>provider);
  };

  const sleep = async (time) => {
    return new Promise((resolve) => {
      setTimeout(resolve, time * 1000);
    });
  };

  const forwardTime = async (time) => {
    if (isRealChain) {
      await sleep(time);
      _currentTime = new Date().getTime() / 1000;
      return;
    }
    // "Roads? Where we’re going, we don’t need roads."
    const date = new Date().getTime() / 1000;
    _currentTime =
      date + (await ethersProvider.send('evm_increaseTime', [time]));
    return await ethersProvider.send('evm_mine', []);
  };

  before(
    mochaAsync(async () => {
      return new Promise<void>(async (resolve) => {
        const network = process.env.CHAIN_NAME as SupportedNetworks;
        // Instance Application
        app = new Application({
          test: true,
          network: isRealChain ? network : 'ETH',
          web3: isRealChain ? undefined : getWeb3(),
        });
        app.web3.eth.transactionConfirmationBlocks = 1;

        // Deploy the ERC20
        const contract = new Contract(app.web3, ierc20.abi);
        const response = await contract.deploy(
          app.account,
          ierc20.abi,
          ierc20.bytecode,
          [],
          undefined
        );
        ERC20TokenAddress = response.contractAddress;
        resolve();
      });
    })
  );

  it(
    'should deploy Fixed NFT Swap Contract',
    mochaAsync(async () => {
      /* Create Contract */
      swapContract = await app.getFixedNFTSwapContract({});
      /* Deploy */
      const res = await swapContract.deploy({
        ERC20TradingAddress: ERC20TokenAddress,
        tradingDecimals: 18,
        individualMaximumAmount: 0.1,
        startDate: moment().add(4, 'minutes'),
        endDate: moment().add(8, 'minutes'),
        distributionDate: moment().add(9, 'minutes'),
        hasWhitelisting: false,
        categoryIds: [1, 2],
        categoriesSupply: [tokenFundAmount, 3],
        categoriesPrice: [tradeValue, 0.02],
      });
      contractAddress = swapContract.getAddress();
      await swapContract.approveSwapERC20({
        tokenAmount: 1,
        callback: () => {},
      });
      expect(res).to.not.equal(false);

      expect(await swapContract.getTradingDecimals()).to.equal(18);
    })
  );

  it(
    'should get the correct smart contract version',
    mochaAsync(async () => {
      expect(await swapContract.getSmartContractVersion()).to.equal(3100000);
    })
  );

  it(
    'should get a Fixed Swap Contract From contractAddress - 2.0',
    mochaAsync(async () => {
      /* Get Contract */
      swapContract = await app.getFixedNFTSwapContract({ contractAddress });
      swapContract.__init__();
      await swapContract.assertERC20Info();
      expect(swapContract.version).to.equal('2.0');
      expect(swapContract).to.not.equal(false);
    })
  );

  it(
    'GET - isPreFunded',
    mochaAsync(async () => {
      const res = await swapContract.isPreStart();
      expect(res).to.equal(true);
    })
  );

  it(
    'GET - tokensLeft',
    mochaAsync(async () => {
      const tokens = await swapContract.tokensLeft({ categoryId: 1 });
      tokensLeft = Number(tokens);
      expect(tokensLeft).to.equal(tokenFundAmount);
    })
  );

  it(
    'should edit start Date',
    mochaAsync(async () => {
      const oldStartDate = await swapContract.startDate();

      const newStartDate = new Date(oldStartDate.getTime() + 1 * 1000);
      await swapContract.setStartDate({ startDate: newStartDate });
      let res = await swapContract.startDate();
      expect(res.getTime()).to.equal(newStartDate.getTime());

      await swapContract.setStartDate({ startDate: oldStartDate });
      res = await swapContract.startDate();
      expect(res.getTime()).to.equal(oldStartDate.getTime());
    })
  );

  it(
    'should edit end Date',
    mochaAsync(async () => {
      const oldEndDate = await swapContract.endDate();

      const newEndDate = new Date(oldEndDate.getTime() + 30 * 1000);
      await swapContract.setEndDate({ endDate: newEndDate });
      let res = await swapContract.endDate();
      expect(res.getTime()).to.equal(newEndDate.getTime());

      await swapContract.setEndDate({ endDate: oldEndDate });
      res = await swapContract.endDate();
      expect(res.getTime()).to.equal(oldEndDate.getTime());
    })
  );

  it(
    'should edit distribution date',
    mochaAsync(async () => {
      const oldDistributionDate = await swapContract.distributionDate();
      const newDistributionDate = new Date(
        oldDistributionDate.getTime() + 86400 * 1000
      );

      await swapContract.setDistributionDate({
        distributionDate: newDistributionDate,
      });
      let res = await swapContract.distributionDate();
      expect(res.getTime()).to.equal(newDistributionDate.getTime());

      await swapContract.setDistributionDate({
        distributionDate: oldDistributionDate,
      });
      res = await swapContract.distributionDate();
      expect(res.getTime()).to.equal(oldDistributionDate.getTime());
    })
  );

  it(
    'GET - isSaleOpen - before Start',
    mochaAsync(async () => {
      await forwardTime(4 * 60);
      const res = await swapContract.isOpen();
      isSaleOpen = res;
      expect(res).to.equal(true);
    })
  );

  it(
    'GET - hasWhitelisting ',
    mochaAsync(async () => {
      const res = await swapContract.hasWhitelisting();
      expect(res).to.equal(false);
    })
  );

  it(
    'GET - startDate ',
    mochaAsync(async () => {
      const startDate = await swapContract.startDate();
      expect(startDate).to.be.instanceOf(Date);
    })
  );

  it(
    'GET - endDate ',
    mochaAsync(async () => {
      const endDate = await swapContract.endDate();
      expect(endDate).to.be.instanceOf(Date);
    })
  );

  it(
    'GET - category ids ',
    mochaAsync(async () => {
      const res = await swapContract.categoryIds();
      expect(Number(res[0])).to.equal(1);
      expect(Number(res[1])).to.equal(2);
    })
  );

  it(
    'GET - individualMaximumAmount ',
    mochaAsync(async () => {
      const res = await swapContract.individualMaximumAmount();
      indivMaxAmount = res;
      expect(res).to.equal(0.1);
    })
  );

  it(
    'GET - getCostFromTokens ',
    mochaAsync(async () => {
      const res = await swapContract.getCost({ amount: 2, categoryId: 2 });
      expect(res).to.equal(0.04);
    })
  );

  it(
    'check conditions for swap  ',
    mochaAsync(async () => {
      const amountLargerThanZero = tokenPurchaseAmount > 0;
      const hasTokensLeft = tokenPurchaseAmount <= tokensLeft;
      const isValidIndivMaxAmount = tokenPurchaseAmount <= indivMaxAmount;
      expect(isSaleOpen).to.equal(true);
      expect(amountLargerThanZero).to.equal(true);
      expect(hasTokensLeft).to.equal(true);
      expect(isValidIndivMaxAmount).to.equal(true);
    })
  );

  it(
    'GET - hasStarted',
    mochaAsync(async () => {
      await forwardTime(1 * 60);
      const res = await swapContract.hasStarted();
      expect(res).to.equal(true);
    })
  );

  it(
    'GET - isSaleOpen',
    mochaAsync(async () => {
      const res = await swapContract.isOpen();
      expect(res).to.equal(true);
    })
  );

  it(
    'Edit max allocation - Admin',
    mochaAsync(async () => {
      const newMax = 500;
      const res = await swapContract.setIndividualMaximumAmount({
        individualMaximumAmount: newMax,
      });
      expect(res).to.not.equal(false);
      expect(await swapContract.individualMaximumAmount()).to.equal(newMax);
    })
  );

  it(
    'should do a non atomic swap on the Contract',
    mochaAsync(async () => {
      await forwardTime(5);
      let res = await swapContract.swap({
        tokenAmount: 2,
        categoryId: 1,
        maxAllocation: 0,
      });
      expect(res).to.not.equal(false);
      res = await swapContract.swap({
        tokenAmount: 1,
        categoryId: 1,
        maxAllocation: 0,
      });
      expect(res).to.not.equal(false);
    })
  );

  it(
    'GET - Purchases',
    mochaAsync(async () => {
      const purchases = await swapContract.getPurchaseIds();
      expect(purchases.length).to.equal(2);
    })
  );

  it(
    'GET - My Purchases',
    mochaAsync(async () => {
      const purchases = await swapContract.getAddressPurchaseIds({
        address: app.account.getAddress(),
      });
      expect(purchases.length).to.equal(2);
    })
  );

  it(
    'GET - Purchase ID',
    mochaAsync(async () => {
      const purchases = await swapContract.getAddressPurchaseIds({
        address: app.account.getAddress(),
      });
      const { amount, amountContributed, purchaser, reverted } =
        await swapContract.getPurchase({
          purchaseId: purchases[0],
        });

      expect(amount).to.equal(2);
      expect(amountContributed).to.equal(tradeValue * 2);
      expect(purchaser).to.equal(app.account.getAddress());
      expect(reverted).to.equal(false);
    })
  );

  it(
    'GET - tokensLeft after Swap',
    mochaAsync(async () => {
      const tokens = await swapContract.tokensLeft({ categoryId: 1 });
      tokensLeft = tokenFundAmount - 3;
      expect(Number(tokens)).to.equal(tokensLeft);
    })
  );

  it(
    'GET - soldByCategoryId',
    mochaAsync(async () => {
      const soldByCategoryId = await swapContract.soldByCategoryId({
        categoryId: 1,
      });
      expect(Number(soldByCategoryId)).to.equal(3);
    })
  );

  it(
    'GET - Buyers',
    mochaAsync(async () => {
      const buyers = await swapContract.getBuyers();
      expect(buyers.length).to.equal(2);
    })
  );

  it(
    'GET - Fixed Swap is Closed',
    mochaAsync(async () => {
      await forwardTime(4 * 60);
      let res = await swapContract.hasFinalized();
      expect(res).to.equal(true);
      res = await swapContract.isOpen();
      expect(res).to.equal(false);
    })
  );

  it(
    'GET - Purchase ID 2',
    mochaAsync(async () => {
      const purchases = await swapContract.getAddressPurchaseIds({
        address: app.account.getAddress(),
      });
      const purchase = await swapContract.getPurchase({
        purchaseId: purchases[0],
      });
      expect(purchase.purchaser).to.equal(app.account.getAddress());
      expect(purchase.reverted).to.equal(false);
    })
  );

  it(
    'GET - HasMinimumRaise',
    mochaAsync(async () => {
      const hasMinimumRaise = await swapContract.hasMinimumRaise();
      expect(hasMinimumRaise).to.equal(false);
    })
  );

  it(
    'GET - Minimum Raise Not having',
    mochaAsync(async () => {
      const minimumRaise = await swapContract.minimumRaise();
      expect(Number(minimumRaise)).to.equal(0);
    })
  );

  it(
    'GET - MinimumReached with no minimum',
    mochaAsync(async () => {
      const minimumReached = await swapContract.minimumReached();
      expect(minimumReached).to.equal(true);
    })
  );

  it(
    'GET - MinimumReached with minimum not satisfied',
    mochaAsync(async () => {
      const minimumReached = await swapContract.minimumReached();
      expect(minimumReached).to.equal(true);
    })
  );

  it(
    'GET - Allocated tokens',
    mochaAsync(async () => {
      const tokensAllocated = await swapContract.tokensAllocated();
      expect(Number(tokensAllocated)).to.equal(3 * tradeValue);
    })
  );

  it(
    'GET - Tokens for sale',
    mochaAsync(async () => {
      const tokensForSale = await swapContract.tokensForSale({ categoryId: 1 });
      expect(Number(tokensForSale)).to.equal(tokenFundAmount);
    })
  );

  it(
    'Remove ETH From Purchases - Admin',
    mochaAsync(async () => {
      const res = await swapContract.withdrawFunds();
      expect(res).to.not.equal(false);
    })
  );

  it(
    'Add to blacklist - Admin',
    mochaAsync(async () => {
      const res = await swapContract.addToBlacklist({
        address: '0xfAadFace3FbD81CE37B0e19c0B65fF4234148132',
      });
      expect(res).to.not.equal(false);
      expect(
        await swapContract.isBlacklisted({
          address: '0xfAadFace3FbD81CE37B0e19c0B65fF4234148132',
        })
      ).to.equal(true);
    })
  );

  it(
    'Remove from blacklist - Admin',
    mochaAsync(async () => {
      const res = await swapContract.removeFromBlacklist({
        address: '0xfAadFace3FbD81CE37B0e19c0B65fF4234148132',
      });
      expect(res).to.not.equal(false);
      expect(
        await swapContract.isBlacklisted({
          address: '0xfAadFace3FbD81CE37B0e19c0B65fF4234148132',
        })
      ).to.equal(false);
    })
  );

  it(
    'GET User purchases',
    mochaAsync(async () => {
      const purchases = await swapContract.getUserPurchases({
        address: app.account.getAddress(),
      });
      expect(purchases.length).to.equal(2);
      expect(purchases[0].categoryId).to.equal(1);
      expect(purchases[0].amount).to.equal(2);
    })
  );

  it(
    'GET User purchase',
    mochaAsync(async () => {
      const purchase = await swapContract.getPurchase({ purchaseId: 0 });
      expect(purchase.categoryId).to.equal(1);
      expect(purchase.amount).to.equal(2);
    })
  );

  it(
    'GET Is Claimed category',
    mochaAsync(async () => {
      const claimed = await swapContract.getIsClaimedCategoryForUser({
        address: app.account.getAddress(),
        categoryId: 1,
      });
      expect(claimed).to.equal(false);
    })
  );
});
