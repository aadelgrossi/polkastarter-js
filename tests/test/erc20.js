require('dotenv').config();

import chai from 'chai';
import { mochaAsync } from '../utils';
import moment, { isDate } from 'moment';
import Application from '../../src';
import delay from 'delay';
const ERC20TokenAddress = '0x7a7748bd6f9bac76c2f3fcb29723227e3376cbb2';
var contractAddress = '0x420751cdeb28679d8e336f2b4d1fc61df7439b5a';
var userPrivateKey = process.env.TEST_PRIVATE_KEY || '0x7f76de05082c4d578219ca35a905f8debe922f1f00b99315ebf0706afc97f132';

const expect = chai.expect;
const tokenPurchaseAmount = 0.01;
const tokenFundAmount = 0.03;
const tradeValue = 0.01;

context('ERC-20 Contract', async () => {
    var swapContract;
    var app;
    var isFunded, isSaleOpen, hasWhitelist, tokensLeft, indiviMinAmount, indivMaxAmount, cost, tokensAvailable

    before( async () =>  {
        app = new Application({test : true, mainnet : false});
    });

    it('should deploy Fixed Swap Contract', mochaAsync(async () => {

        app = new Application({test : true, mainnet : false});
        /* Create Contract */
        swapContract = await app.getFixedSwapContract({tokenAddress : ERC20TokenAddress, decimals : 18});
        /* Deploy */
        let res = await swapContract.deploy({
            tradeValue : tradeValue,
            tokensForSale : tokenFundAmount,
            isTokenSwapAtomic : true,
            individualMaximumAmount : tokenFundAmount,
            startDate : moment().add(4, 'minutes'),
            endDate : moment().add(8, 'minutes'),
            hasWhitelisting : false,
            isETHTrade : false,
            ERC20TradingAddress: "0x59dd38615070ac185583a9a43059aa833685d49d",
            isPOLSWhitelist: false,
            tradingDecimals: 18,
		    vestingTime: 1,
		    vestingSchedule: [100]
        });
        contractAddress = swapContract.getAddress();
        expect(res).to.not.equal(false);
    }));

    it('should get a Fixed Swap Contract From contractAddress', mochaAsync(async () => {

        /* Get Contract */
        swapContract = await app.getFixedSwapContract({contractAddress});
        swapContract.__init__();
        await swapContract.assertERC20Info();
        expect(swapContract).to.not.equal(false);
    }));

    it('GET - isPreFunded', mochaAsync(async () => {
        let res = await swapContract.isPreStart();
        expect(res).to.equal(true);
    }));

    it('GET - tokensAllocated', mochaAsync(async () => {
        let tokens = await swapContract.tokensAllocated();
        expect(tokens).to.equal(Number(0).noExponents());
    }));

    it('GET - tradeValue', mochaAsync(async () => {
        let td = await swapContract.tradeValue();
        expect(td).to.equal(Number(tradeValue).noExponents());
    }));

    it('GET - tokensAvailable', mochaAsync(async () => {
        let tokens = await swapContract.tokensAvailable();
        expect(tokens).to.equal(Number(0).noExponents());
    }));

    it('GET - owner', mochaAsync(async () => {
        let res = await swapContract.owner();
        expect(res).to.equal('0xe797860acFc4e06C1b2B96197a7dB1dFa518d5eB');
    }));

    it('GET - tokensForSale', mochaAsync(async () => {
        let tokens = await swapContract.tokensForSale();
        expect(Number(tokens).noExponents()).to.equal(Number(tokenFundAmount).noExponents());
    }));

    it('GET - tokensLeft', mochaAsync(async () => {
        let tokens = await swapContract.tokensLeft();
        tokensLeft = tokens;
        expect(Number(tokens).noExponents()).to.equal(Number(tokenFundAmount).noExponents());
    }));

    it('should fund a Swap Contract and confirm balances', mochaAsync(async () => {
        /* Approve ERC20 Fund */
        let res = await swapContract.approveFundERC20({tokenAmount : tokenFundAmount});
        expect(res).to.not.equal(false);
        res = await swapContract.isApproved({address : app.account.getAddress(), tokenAmount : tokenFundAmount});
        expect(res).to.equal(true);
        /* Fund */
        res = await swapContract.hasStarted();
        expect(res).to.equal(false);
        res = await swapContract.fund({tokenAmount : tokenFundAmount});
        expect(res).to.not.equal(false);
    }));


    it('GET - tokensAvailable', mochaAsync(async () => {
        let tokens = await swapContract.tokensAvailable();
        expect(tokens).to.equal(Number(tokenFundAmount).noExponents());
    }));

    it('GET - isFunded', mochaAsync(async () => {
        let res = await swapContract.isFunded();
        isFunded = res;
        expect(res).to.equal(true);
    }));

    it('GET - isSaleOpen - before Start', mochaAsync(async () => {
        await delay(2*60*1000);
        let res = await swapContract.isOpen();
        isSaleOpen = res;
        expect(res).to.equal(true);
    }));

    it('GET - tokensAvailable after fund', mochaAsync(async () => {
        let tokens = await swapContract.tokensAvailable();
        expect(tokens).to.equal(Number(tokens).noExponents());
    }));

    it('should approve ERC20 swap', mochaAsync(async () => {
        await delay(15*1000);
        let res = await swapContract.approveSwapERC20({tokenAmount : tokenPurchaseAmount});
        expect(res).to.not.equal(false);
    }));

    it('should do a non atomic swap on the Contract', mochaAsync(async () => {
        await delay(15*1000);
        let res = await swapContract.swap({tokenAmount : tokenPurchaseAmount});
        expect(res).to.not.equal(false);
    }));

    it('GET - Purchases', mochaAsync(async () => {
        let purchases = await swapContract.getPurchaseIds();
        expect(purchases.length).to.equal(1);
    }));

    it('GET - My Purchases', mochaAsync(async () => {
        let purchases = await swapContract.getAddressPurchaseIds({address : app.account.getAddress()});
        expect(purchases.length).to.equal(1);
    }));

    it('GET - Purchase ID', mochaAsync(async () => {
        let purchases = await swapContract.getAddressPurchaseIds({address : app.account.getAddress()});
        let purchase = await swapContract.getPurchase({purchase_id : purchases[0]});
        const amountPurchase = Number(purchase.amount).noExponents();
        expect(Number(amountPurchase).toFixed(2)).to.equal(Number(tokenPurchaseAmount).noExponents());
        expect(purchase.purchaser).to.equal(app.account.getAddress());
        expect(purchase.wasFinalized).to.equal(true);
        expect(purchase.reverted).to.equal(false);
    }));

    it('GET - tokensAvailable after Swap', mochaAsync(async () => {
        let tokens = await swapContract.tokensAvailable();
        tokens = Number(tokens).noExponents();
        tokensAvailable = Number(tokenFundAmount-tokenPurchaseAmount).noExponents();
        expect(Number(tokens).toFixed(2)).to.equal(Number(tokensAvailable).toFixed(2));
    }));

    it('GET - Buyers', mochaAsync(async () => {
        let buyers = await swapContract.getBuyers();
        expect(buyers.length).to.equal(1);
    }));

    it('GET - Fixed Swap is Closed', mochaAsync(async () => {
        await delay(4*60*1000);
        let res = await swapContract.hasFinalized();
        expect(res).to.equal(true);
        res = await swapContract.isOpen();
        expect(res).to.equal(false);
    }));

    it('GET - tokensAvailable after closed', mochaAsync(async () => {
        let res = await swapContract.tokensAvailable();
        res = Number(res).noExponents()
        expect(Number(res).toFixed(2)).to.equal(Number(tokensAvailable).toFixed(2));
    }));

    it('Remove Tokens From Purchases - Admin', mochaAsync(async () => {
        let res = await swapContract.withdrawFunds();
        expect(res).to.not.equal(false);
    }));

    it('Remove Unsold Tokens - Admin', mochaAsync(async () => {
        let res = await swapContract.withdrawUnsoldTokens();
        expect(res).to.not.equal(false);
    }));

    it('should deploy Fixed Swap Contract - isPOLSWhitelisted', mochaAsync(async () => {
        /*
          It is necessary to create in the future, as it is necessary to simulate a "uniswap"
          with the entire structure of the kovan network.
        */
    }));
});
