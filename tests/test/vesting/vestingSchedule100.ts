import { FixedSwapContractLegacy, FixedSwapContract } from '@contracts';
import { mochaAsync } from '@test-utils';
import chai from 'chai';
import delay from 'delay';
import moment from 'moment';

import { Application } from '../../../src';

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

context('Vesting Time = 1 And Vesting Schedule = 100', () => {
  let swapContract: FixedSwapContract | FixedSwapContractLegacy;
  let app: Application;

  before(async () => {
    app = new Application({ test: true });
  });

  it(
    'should deploy Fixed Swap Contract',
    mochaAsync(async () => {
      app = new Application({ test: true });
      /* Create Contract */
      swapContract = await app.getFixedSwapContract({
        tokenAddress: ERC20TokenAddress,
        decimals: 18,
      });
      /* Deploy */
      const res = await swapContract.deploy({
        tradeValue,
        tokensForSale: tokenFundAmount,
        isTokenSwapAtomic: false,
        individualMaximumAmount: tokenFundAmount,
        startDate: moment().add(4, 'minutes'),
        endDate: moment().add(8, 'minutes'),
        hasWhitelisting: false,
        callback: () => {},
        // firstUnlock: 100,
      });
      contractAddress = swapContract.getAddress();
      expect(res).to.not.equal(false);
    })
  );

  it(
    'should get a Fixed Swap Contract From contractAddress',
    mochaAsync(async () => {
      /* Get Contract */
      swapContract = await app.getFixedSwapContract({ contractAddress });
      swapContract.__init__();
      await swapContract.assertERC20Info();
      expect(swapContract).to.not.equal(false);
    })
  );

  it(
    'should fund a Swap Contract and confirm balances',
    mochaAsync(async () => {
      /* Approve ERC20 Fund */
      let res = await swapContract.approveFundERC20({
        tokenAmount: tokenFundAmount,
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
    'GET - isSaleOpen - before Start',
    mochaAsync(async () => {
      await delay(3 * 60 * 1000);
      const saleOpen = await swapContract.isOpen();
      expect(saleOpen).to.equal(true);
    })
  );

  it(
    'should do a non atomic swap on the Contract',
    mochaAsync(async () => {
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
    'GET - Purchase ID',
    mochaAsync(async () => {
      const purchases = await swapContract.getAddressPurchaseIds({
        address: app.account.getAddress(),
      });
      const { amount, purchaser, wasFinalized, reverted } =
        await swapContract.getPurchase({
          purchase_id: purchases[0],
        });

      expect(amount).to.equal(tokenPurchaseAmount);
      expect(purchaser).to.equal(app.account.getAddress());
      expect(wasFinalized).to.equal(false);
      expect(reverted).to.equal(false);
    })
  );

  it(
    'Should Redeem Tokens',
    mochaAsync(async () => {
      const purchases = await swapContract.getAddressPurchaseIds({
        address: app.account.getAddress(),
      });
      const purchase = await swapContract.getPurchase({
        purchase_id: purchases[0],
      });
      const redeemTokens = await swapContract.redeemTokens({
        purchase_id: purchase._id,
      });
      expect(redeemTokens.from).to.equal(app.account.getAddress());
      expect(redeemTokens.status).to.equal(true);
    })
  );

  it(
    'GET - Distribution Info',
    mochaAsync(async () => {
      const { vestingTime, vestingSchedule } =
        await swapContract.getDistributionInformation();
      expect(vestingTime).to.equal(1);
      expect(vestingSchedule).to.deep.equal([100]);
    })
  );

  it(
    'GET - Purchase ID After Redeem',
    mochaAsync(async () => {
      const purchases = await swapContract.getAddressPurchaseIds({
        address: app.account.getAddress(),
      });
      const { amount, purchaser, wasFinalized, reverted } =
        await swapContract.getPurchase({
          purchase_id: purchases[0],
        });
      expect(amount).to.equal(tokenPurchaseAmount);
      expect(purchaser).to.equal(app.account.getAddress());
      expect(wasFinalized).to.equal(false);
      expect(reverted).to.equal(false);
    })
  );
});
