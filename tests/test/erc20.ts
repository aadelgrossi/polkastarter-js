/* eslint-disable no-underscore-dangle */
import { FixedSwapContractLegacy, FixedSwapContract } from '@contracts';
import { mochaAsync } from '@test-utils';
import chai from 'chai';
import delay from 'delay';
import moment from 'moment';

import { Application } from '../../src';

require('dotenv').config();

const ERC20TokenAddress = '0x7a7748bd6f9bac76c2f3fcb29723227e3376cbb2';
let contractAddress = '0x420751cdeb28679d8e336f2b4d1fc61df7439b5a';
const userPrivateKey =
  process.env.TEST_PRIVATE_KEY ||
  '0x7f76de05082c4d578219ca35a905f8debe922f1f00b99315ebf0706afc97f132';

const { expect } = chai;
const tokenPurchaseAmount = 0.01;
const tokenFundAmount = 0.03;
const tradeValue = 0.01;

context('ERC-20 Contract', () => {
  let swapContract: FixedSwapContract | FixedSwapContractLegacy;
  let app: Application;
  let isFunded;
  let isSaleOpen;
  let hasWhitelist;
  let tokensLeft;
  let indiviMinAmount;
  let indivMaxAmount;
  let cost;
  let tokensAvailable;

  before(async () => {
    app = new Application({ test: true });
  });

  it(
    'should deploy Fixed Swap Contract',
    mochaAsync(async () => {
      app = new Application({ test: true });
      /* Create Contract */
      swapContract = (await app.getFixedSwapContract({
        tokenAddress: ERC20TokenAddress,
        decimals: 18,
      })) as FixedSwapContract;
      /* Deploy */
      const res = await swapContract.deploy({
        tradeValue,
        tokensForSale: tokenFundAmount,
        isTokenSwapAtomic: true,
        individualMaximumAmount: tokenFundAmount,
        startDate: moment().add(4, 'minutes'),
        endDate: moment().add(8, 'minutes'),
        hasWhitelisting: false,
        ERC20TradingAddress: '0x59dd38615070ac185583a9a43059aa833685d49d',
        isPOLSWhitelist: false,
        tradingDecimals: 18,
        vestingStart: null,
        callback: () => {},
        vestingSchedule: [100],
      });
      contractAddress = swapContract.getAddress();
      expect(res).to.not.equal(false);
    })
  );

  it(
    'should get a Fixed Swap Contract From contractAddress',
    mochaAsync(async () => {
      /* Get Contract */
      swapContract = await app.getFixedSwapContract({
        tokenAddress: ERC20TokenAddress,
        contractAddress,
      });
      swapContract.__init__();
      await swapContract.assertERC20Info();
      expect(swapContract).to.not.equal(false);
    })
  );

  it(
    'GET - isPreFunded',
    mochaAsync(async () => {
      const res = await (swapContract as FixedSwapContract).isPreStart();
      expect(res).to.equal(true);
    })
  );

  it(
    'GET - tokensAllocated',
    mochaAsync(async () => {
      const tokens = await swapContract.tokensAllocated();
      expect(tokens).to.equal(0);
    })
  );

  it(
    'GET - tradeValue',
    mochaAsync(async () => {
      const td = await swapContract.tradeValue();
      expect(td).to.equal(tradeValue);
    })
  );

  it(
    'GET - tokensAvailable',
    mochaAsync(async () => {
      const tokens = await swapContract.tokensAvailable();
      expect(tokens).to.equal(0);
    })
  );

  it(
    'GET - owner',
    mochaAsync(async () => {
      const fixedSwapContract = swapContract as FixedSwapContractLegacy;
      const res = await fixedSwapContract.owner();
      expect(res).to.equal('0xe797860acFc4e06C1b2B96197a7dB1dFa518d5eB');
    })
  );

  it(
    'GET - tokensForSale',
    mochaAsync(async () => {
      const tokens = await swapContract.tokensForSale();
      expect(tokens).to.equal(tokenFundAmount);
    })
  );

  it(
    'GET - tokensLeft',
    mochaAsync(async () => {
      const tokens = await swapContract.tokensLeft();
      expect(tokens).to.equal(tokenFundAmount);
    })
  );

  it(
    'should fund a Swap Contract and confirm balances',
    mochaAsync(async () => {
      /* Approve ERC20 Fund */
      let res = await swapContract.approveFundERC20({
        tokenAmount: tokenFundAmount,
        callback: null,
      });
      expect(res).to.not.equal(false);
      res = await swapContract.isApproved({
        address: app.account.getAddress(),
        tokenAmount: tokenFundAmount,
      });
      expect(res).to.equal(true);
      /* Fund */
      res = await swapContract.hasStarted();
      expect(res).to.equal(false);
      res = await swapContract.fund({ tokenAmount: tokenFundAmount });
      expect(res).to.not.equal(false);
    })
  );

  it(
    'GET - tokensAvailable 2',
    mochaAsync(async () => {
      const tokens = await swapContract.tokensAvailable();
      expect(tokens).to.equal(tokenFundAmount);
    })
  );

  it(
    'GET - isFunded',
    mochaAsync(async () => {
      const funded = await swapContract.isFunded();
      expect(funded).to.equal(true);
    })
  );

  it(
    'GET - isSaleOpen - before Start',
    mochaAsync(async () => {
      await delay(2 * 60 * 1000);
      const open = await swapContract.isOpen();
      expect(open).to.equal(true);
    })
  );

  it(
    'GET - tokensAvailable after fund',
    mochaAsync(async () => {
      const tokens = await swapContract.tokensAvailable();
      expect(tokens).to.equal(tokens);
    })
  );

  it(
    'should approve ERC20 swap',
    mochaAsync(async () => {
      await delay(15 * 1000);
      const res = await swapContract.approveSwapERC20({
        tokenAmount: tokenPurchaseAmount,
        callback: () => {},
      });
      expect(res).to.not.equal(false);
    })
  );

  it(
    'should do a non atomic swap on the Contract',
    mochaAsync(async () => {
      await delay(15 * 1000);
      const res = await swapContract.swap({ tokenAmount: tokenPurchaseAmount });
      expect(res).to.not.equal(false);
    })
  );

  it(
    'GET - Purchases',
    mochaAsync(async () => {
      const purchases = await swapContract.getPurchaseIds();
      expect(purchases.length).to.equal(1);
    })
  );

  it(
    'GET - My Purchases',
    mochaAsync(async () => {
      const purchases = await swapContract.getAddressPurchaseIds({
        address: app.account.getAddress(),
      });
      expect(purchases.length).to.equal(1);
    })
  );

  it(
    'GET - Purchase ID',
    mochaAsync(async () => {
      const purchases = await swapContract.getAddressPurchaseIds({
        address: app.account.getAddress(),
      });
      const purchase = await swapContract.getPurchase({
        purchase_id: purchases[0],
      });
      const amountPurchase = purchase.amount;
      expect(Number(amountPurchase).toFixed(2)).to.equal(tokenPurchaseAmount);
      expect(purchase.purchaser).to.equal(app.account.getAddress());
      expect(purchase.wasFinalized).to.equal(true);
      expect(purchase.reverted).to.equal(false);
    })
  );

  it(
    'GET - tokensAvailable after Swap',
    mochaAsync(async () => {
      const tokens = await swapContract.tokensAvailable();
      tokensAvailable = tokenFundAmount - tokenPurchaseAmount;
      expect(tokens.toFixed(2)).to.equal(tokensAvailable.toFixed(2));
    })
  );

  it(
    'GET - Buyers',
    mochaAsync(async () => {
      const buyers = await swapContract.getBuyers();
      expect(buyers.length).to.equal(1);
    })
  );

  it(
    'GET - Fixed Swap is Closed',
    mochaAsync(async () => {
      await delay(4 * 60 * 1000);
      let res = await swapContract.hasFinalized();
      expect(res).to.equal(true);
      res = await swapContract.isOpen();
      expect(res).to.equal(false);
    })
  );

  it(
    'GET - tokensAvailable after closed',
    mochaAsync(async () => {
      const res = await swapContract.tokensAvailable();
      expect(res.toFixed(2)).to.equal(tokensAvailable.toFixed(2));
    })
  );

  it(
    'Remove Tokens From Purchases - Admin',
    mochaAsync(async () => {
      const res = await swapContract.withdrawFunds();
      expect(res).to.not.equal(false);
    })
  );

  it(
    'Remove Unsold Tokens - Admin',
    mochaAsync(async () => {
      const res = await swapContract.withdrawUnsoldTokens();
      expect(res).to.not.equal(false);
    })
  );

  it(
    'should deploy Fixed Swap Contract - isPOLSWhitelisted',
    mochaAsync(async () => {
      /*
          It is necessary to create in the future, as it is necessary to simulate a "uniswap"
          with the entire structure of the kovan network.
        */
    })
  );
});
