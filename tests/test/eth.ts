/* eslint-disable no-await-in-loop */
/* eslint-disable no-plusplus */
/* eslint-disable no-restricted-syntax */
/* eslint-disable mocha/no-setup-in-describe */
import chai from 'chai';
import * as ethers from 'ethers';
import ganache from 'ganache-core';
import moment from 'moment';
import Web3 from 'web3';

import { Application, FixedSwapContract } from '../../src';
import { SupportedNetworks } from '../../src/constants/networks';
import { ierc20, swapv2 } from '../../src/interfaces';
import { Contract } from '../../src/models/base';
import IDOStaking from '../../src/models/contracts/IDOStaking';
import { Numbers } from '../../src/utils';
import { mochaAsync } from '../utils';

require('dotenv').config();

let ERC20TokenAddress = '0x7a7748bd6f9bac76c2f3fcb29723227e3376cbb2';
let contractAddress = '0x420751cdeb28679d8e336f2b4d1fc61df7439b5a';
const userPrivateKey =
  '0x7f76de05082c4d578219ca35a905f8debe922f1f00b99315ebf0706afc97f132';

const { expect } = chai;
let tokenPurchaseAmount = 0.01;
const tokenFundAmount = 0.03;
const tradeValue = 0.01;

// Set to true if yu want to test the fixed swap v2 contract
const oldContract = false;

context('ETH Contract', () => {
  let swapContract: FixedSwapContract;
  let app: Application;
  let ethersProvider: ethers.ethers.providers.Web3Provider;
  let isFunded: boolean;
  let isSaleOpen: boolean;
  let tokensLeft: number;
  let indiviMinAmount: number;
  let indivMaxAmount: number;
  let currentTime = new Date().getTime() / 1000;

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
          balance: 10000000000000000000,
        },
      ],
    });
    ethersProvider = new ethers.providers.Web3Provider(<any>provider);
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
      currentTime = new Date().getTime() / 1000;
      return;
    }
    // "Roads? Where we’re going, we don’t need roads."
    const date = new Date().getTime() / 1000;
    currentTime =
      date + (await ethersProvider.send('evm_increaseTime', [time]));
    return await ethersProvider.send('evm_mine', []);
  };

  before(
    mochaAsync(async () => {
      return new Promise<void>(async (resolve) => {
        // Instance Application
        const network = (process.env.CHAIN_NAME as SupportedNetworks) || 'ETH';
        const web3 = isRealChain ? undefined : getWeb3();
        app = new Application({ test: true, network, web3 });
        app.web3.eth.transactionConfirmationBlocks = 1;
        currentTime = new Date().getTime() / 1000;

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
    'should deploy Fixed Swap Contract',
    mochaAsync(async () => {
      /* Create Contract */
      swapContract = (await app.getFixedSwapContract({
        tokenAddress: ERC20TokenAddress,
      })) as FixedSwapContract;
      /* Deploy */
      let res;
      if (oldContract) {
        const params = [
          ERC20TokenAddress,
          Numbers.toSmartContractDecimals(tradeValue, 18),
          Numbers.toSmartContractDecimals(tokenFundAmount, 18),
          Numbers.timeToSmartContractTime(moment().add(4, 'minutes').unix()),
          Numbers.timeToSmartContractTime(moment().add(8, 'minutes').unix()),
          Numbers.toSmartContractDecimals(0, 18),
          Numbers.toSmartContractDecimals(tokenFundAmount, 18),
          false,
          Numbers.toSmartContractDecimals(0, 18),
          1,
          false,
          ERC20TokenAddress,
          true,
          false,
          1,
          [100],
        ];
        const contract = new Contract(app.web3, swapv2);
        res = await contract.deploy(
          app.account,
          swapv2.abi,
          swapv2.bytecode,
          params
        );
        swapContract = (await app.getFixedSwapContract({
          tokenAddress: ERC20TokenAddress,
          contractAddress: contract.address,
        })) as FixedSwapContract;
      } else {
        res = await swapContract.deploy({
          tradeValue,
          tokensForSale: tokenFundAmount,
          isTokenSwapAtomic: false,
          individualMaximumAmount: tokenFundAmount,
          startDate: moment().add(4, 'minutes'),
          endDate: moment().add(8, 'minutes'),
          hasWhitelisting: false,
          callback: () => {},
          // isETHTrade: true,
        });
      }
      contractAddress = swapContract.getAddress();
      expect(res).to.not.equal(false);

      expect(await swapContract.getTradingDecimals()).to.equal(18);
    })
  );

  it(
    'should get the correct smart contract version',
    mochaAsync(async () => {
      if (oldContract) {
        expect(true).to.equal(true);
      } else {
        expect(await swapContract.getSmartContractVersion()).to.equal(3100000);
      }
    })
  );

  it(
    'should get a Fixed Swap Contract From contractAddress - 2.0',
    mochaAsync(async () => {
      /* Get Contract */
      swapContract = (await app.getFixedSwapContract({
        contractAddress,
      })) as FixedSwapContract;
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
      tokensLeft = tokens;
      expect(tokens).to.equal(tokenFundAmount);
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
      expect(res).to.not.equal(true);
      res = await swapContract.fund({ tokenAmount: tokenFundAmount });
      expect(res).to.not.equal(false);
      const tokens = await swapContract.tokensAvailable();
      expect(tokens).to.equal(Number(tokenFundAmount));
    })
  );

  it(
    'GET - isFunded',
    mochaAsync(async () => {
      isFunded = await swapContract.isFunded();
      expect(isFunded).to.equal(true);
    })
  );

  it(
    'GET - isSaleOpen - before Start',
    mochaAsync(async () => {
      await forwardTime(4 * 60);
      isSaleOpen = await swapContract.isOpen();
      expect(isSaleOpen).to.equal(true);
    })
  );

  it(
    'GET - hasWhitelisting ',
    mochaAsync(async () => {
      const whitelisting = await swapContract.hasWhitelisting();
      expect(whitelisting).to.equal(false);
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
    'should edit end Date',
    mochaAsync(async () => {
      const oldEndDate = await swapContract.endDate();

      const newEndDate = new Date(oldEndDate.getTime() + 86400 * 1000);
      await swapContract.setEndDate({ endDate: newEndDate });
      let res = await swapContract.endDate();
      expect(res.getTime()).to.equal(newEndDate.getTime());

      await swapContract.setEndDate({ endDate: oldEndDate });
      res = await swapContract.endDate();
      expect(res.getTime()).to.equal(oldEndDate.getTime());
    })
  );

  it(
    'GET - individualMinimumAmount ',
    mochaAsync(async () => {
      indiviMinAmount = await swapContract.individualMinimumAmount();
      expect(indiviMinAmount).to.equal(0);
    })
  );

  it(
    'GET - individualMaximumAmount ',
    mochaAsync(async () => {
      indivMaxAmount = await swapContract.individualMaximumAmount();
      expect(indivMaxAmount).to.equal(tokenFundAmount);
    })
  );

  it(
    'GET - getCostFromTokens ',
    mochaAsync(async () => {
      const response = await swapContract.getCostFromTokens({
        tokenAmount: tokenPurchaseAmount,
      });
      const costFromTokens = response.toFixed(4);
      const expectedCost = (tokenPurchaseAmount * tradeValue).toFixed(4);

      expect(costFromTokens).to.equal(expectedCost);
    })
  );

  it(
    'check conditions for swap',
    mochaAsync(async () => {
      const isAmountValid = tokenPurchaseAmount > 0;
      const hasTokensLeft = tokenPurchaseAmount <= tokensLeft;
      const isValidlMinAmount = tokenPurchaseAmount >= indiviMinAmount;
      const isValidMaxAmount = tokenPurchaseAmount <= indivMaxAmount;

      expect(isFunded).to.equal(true);
      expect(isSaleOpen).to.equal(true);
      expect(isAmountValid).to.equal(true);
      expect(hasTokensLeft).to.equal(true);
      expect(isValidlMinAmount).to.equal(true);
      expect(isValidMaxAmount).to.equal(true);
    })
  );

  it(
    'GET - hasStarted',
    mochaAsync(async () => {
      await forwardTime(1 * 60);
      const started = await swapContract.hasStarted();
      expect(started).to.equal(true);
    })
  );

  it(
    'GET - isSaleOpen',
    mochaAsync(async () => {
      const open = await swapContract.isOpen();
      expect(open).to.equal(true);
    })
  );

  it(
    'Edit max allocation - Admin',
    mochaAsync(async () => {
      if (!oldContract) {
        const newMax = 500;
        const res = await swapContract.setIndividualMaximumAmount({
          individualMaximumAmount: newMax,
        });
        expect(res).to.not.equal(false);
        const updatedMaxAllocation =
          await swapContract.individualMaximumAmount();
        expect(updatedMaxAllocation).to.equal(newMax);
      }
    })
  );

  it(
    'GET - tokensAvailable after fund',
    mochaAsync(async () => {
      const tokens = await swapContract.tokensAvailable();
      expect(tokens).to.equal(Number(tokens));
    })
  );

  it(
    'should do a non atomic swap on the Contract',
    mochaAsync(async () => {
      await forwardTime(5);
      let res;
      if (oldContract) {
        res = await swapContract.__oldSwap({
          tokenAmount: tokenPurchaseAmount,
        });
      } else {
        res = await swapContract.swap({ tokenAmount: tokenPurchaseAmount });
      }
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
    'GET - Distribution Information',
    mochaAsync(async () => {
      // ToDo
      const info = await swapContract.getDistributionInformation();
      console.log(info);
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
      const { amount, purchaser, wasFinalized, reverted, amountToReedemNow } =
        await swapContract.getPurchase({
          purchase_id: purchases[0],
        });
      expect(amount).to.equal(tokenPurchaseAmount);
      expect(purchaser).to.equal(app.account.getAddress());
      expect(wasFinalized).to.equal(false);
      expect(reverted).to.equal(false);
      expect(amountToReedemNow).to.equal(0);
    })
  );

  it(
    'GET - tokensLeft after Swap',
    mochaAsync(async () => {
      const tokens = (await swapContract.tokensLeft()).toFixed(2);
      tokensLeft = Number(tokenFundAmount - tokenPurchaseAmount);

      expect(tokens).to.equal(tokensLeft.toFixed(2));
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
      await forwardTime(4 * 60);
      const finalized = await swapContract.hasFinalized();
      expect(finalized).to.equal(true);
      const open = await swapContract.isOpen();
      expect(open).to.equal(false);
    })
  );

  it(
    'should return withdrawable unsold amount',
    mochaAsync(async () => {
      const res = await swapContract.withdrawableUnsoldTokens();
      console.log(res);
    })
  );

  it(
    'Redeem Sale (withdraw tokens)',
    mochaAsync(async () => {
      const purchases = await swapContract.getAddressPurchaseIds({
        address: app.account.getAddress(),
      });
      const res = await swapContract.redeemTokens({
        purchase_id: purchases[0],
      });
      expect(res).to.not.equal(false);
    })
  );

  it(
    'GET - Purchase ID 2',
    mochaAsync(async () => {
      const purchases = await swapContract.getAddressPurchaseIds({
        address: app.account.getAddress(),
      });
      const { purchaser, wasFinalized, reverted } =
        await swapContract.getPurchase({ purchase_id: purchases[0] });
      // console.log(purchase);
      expect(purchaser).to.equal(app.account.getAddress());
      expect(wasFinalized).to.equal(true);
      expect(reverted).to.equal(false);
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
    'Remove Unsold Tokens - Admin',
    mochaAsync(async () => {
      const withdrawn = await swapContract.withdrawUnsoldTokens();
      expect(withdrawn).to.not.equal(false);
    })
  );

  it(
    'Add to blacklist - Admin',
    mochaAsync(async () => {
      if (!oldContract) {
        const added = await swapContract.addToBlacklist({
          address: '0xfAadFace3FbD81CE37B0e19c0B65fF4234148132',
        });
        const blacklistedAddress = await swapContract.isBlacklisted({
          address: '0xfAadFace3FbD81CE37B0e19c0B65fF4234148132',
        });
        expect(added).to.not.equal(false);
        expect(blacklistedAddress).to.equal(true);
      }
    })
  );

  it(
    'Remove from blacklist - Admin',
    mochaAsync(async () => {
      if (!oldContract) {
        const removed = await swapContract.removeFromBlacklist({
          address: '0xfAadFace3FbD81CE37B0e19c0B65fF4234148132',
        });
        expect(removed).to.not.equal(false);
        const blacklistedAddress = await swapContract.isBlacklisted({
          address: '0xfAadFace3FbD81CE37B0e19c0B65fF4234148132',
        });
        expect(blacklistedAddress).to.equal(false);
      }
    })
  );

  /* Staking Rewards */
  it(
    'should deploy Fixed Swap Contract with staking rewards and swap',
    mochaAsync(async () => {
      /* Create Contract */
      swapContract = (await app.getFixedSwapContract({
        tokenAddress: ERC20TokenAddress,
      })) as FixedSwapContract;
      /* Deploy */
      const startDate = new Date((currentTime + 3 * 60) * 1000);
      const endDate = new Date((currentTime + 8 * 60) * 1000);

      let res = await swapContract.deploy({
        tradeValue,
        tokensForSale: tokenFundAmount,
        isTokenSwapAtomic: false,
        individualMaximumAmount: tokenFundAmount,
        startDate, // 3 mins
        endDate, // 8 mins
        hasWhitelisting: false,
      });
      contractAddress = swapContract.getAddress();
      expect(res).to.not.equal(false);

      const idoStakeToDeploy = new IDOStaking({
        web3: app.web3,
        contractAddress: undefined,
        acc: app.account,
      });
      const tenDays = 10 * 24 * 60 * 60;
      await idoStakeToDeploy.deploy({
        owner: app.account.getAddress(),
        rewardsDistribution: app.account.getAddress(),
        rewardsToken: ERC20TokenAddress,
        stakingToken: ERC20TokenAddress,
        rewardsDuration: tenDays,
      });

      await swapContract.setStakingRewards({
        address: idoStakeToDeploy.params.contractAddress,
      });

      const staking = await swapContract.getIDOStaking();

      await staking.setTokenSaleAddress({ address: contractAddress });

      await swapContract.approveFundERC20({ tokenAmount: tokenFundAmount });
      await swapContract.fund({ tokenAmount: tokenFundAmount });
      await forwardTime(3 * 60);
      res = await swapContract.swap({ tokenAmount: tokenPurchaseAmount });
      expect(res).to.not.equal(false);

      const purchases = await swapContract.getAddressPurchaseIds({
        address: app.account.getAddress(),
      });
      const amount = await staking.stakeAmount({
        address: app.account.getAddress(),
      });
      expect(amount).to.equal(0);

      if (!isRealChain) {
        await forwardTime(6 * 60);

        res = await swapContract.redeemTokens({
          purchase_id: purchases[0],
          stake: true,
        });
        expect(res).to.not.equal(false);

        expect(
          await staking.userAccumulatedRewards({
            address: app.account.getAddress(),
          })
        ).to.equal(0);

        await staking.notifyRewardAmountSamePeriod({ reward: 20 });

        await forwardTime(60 * 60);

        expect(await staking.getAPY()).to.equal(3);
        expect(
          await staking.userAccumulatedRewards({
            address: app.account.getAddress(),
          })
        ).to.equal(0.083356481481480948);
        await app
          .getERC20TokenContract({ tokenAddress: ERC20TokenAddress })
          .transferTokenAmount({
            toAddress: staking.params.contractAddress,
            tokenAmount: 500,
          });

        await staking.claim();

        expect(
          await staking.userAccumulatedRewards({
            address: app.account.getAddress(),
          })
        ).to.equal(0);

        expect(
          await staking.stakeAmount({ address: app.account.getAddress() })
        ).to.equal(0.01);

        expect(await staking.totalStaked()).to.equal(0.01);
        await staking.withdrawAll();
        expect(
          await staking.stakeAmount({ address: app.account.getAddress() })
        ).to.equal(0);
        expect(await staking.totalStaked()).to.equal(0);
      }
    })
  );

  // /* Whitelist */

  it(
    'should deploy Fixed Swap Contract with whitelist and swap',
    mochaAsync(async () => {
      /* Create Contract */
      swapContract = (await app.getFixedSwapContract({
        tokenAddress: ERC20TokenAddress,
      })) as FixedSwapContract;
      /* Deploy */
      let res = await swapContract.deploy({
        tradeValue,
        tokensForSale: tokenFundAmount,
        isTokenSwapAtomic: false,
        individualMaximumAmount: tokenFundAmount,
        startDate: new Date((currentTime + 3 * 60) * 1000), // 3 mins
        endDate: new Date((currentTime + 8 * 60) * 1000), // 8 mins
        hasWhitelisting: true,
      });
      contractAddress = swapContract.getAddress();
      expect(res).to.not.equal(false);

      const signer = app.getSigner();
      const account = await signer.generateSignerAccount({
        password: 'test1234',
      });

      const signs = await signer.signAddresses({
        addresses: ['0xe797860acFc4e06C1b2B96197a7dB1dFa518d5eB'],
        accountMaxAllocations: [tokenPurchaseAmount],
        decimals: 18,
        contractAddress,
        accountJson: account,
        password: 'test1234',
      });

      await swapContract.setSignerPublicAddress({
        address: `0x${JSON.parse(account).address}`.toLowerCase(),
      });
      await swapContract.approveFundERC20({ tokenAmount: tokenFundAmount });
      await swapContract.fund({ tokenAmount: tokenFundAmount });
      await forwardTime(3 * 60);

      res = await swapContract.swapWithSig({
        tokenAmount: tokenPurchaseAmount,
        signature: signs[0].signature,
        accountMaxAmount: signs[0].allocation,
      });
      expect(res).to.not.equal(false);
    })
  );

  // /* Vesting */

  it(
    'should deploy Fixed Swap Contract with vesting and swap',
    mochaAsync(async () => {
      /* Create Contract */
      swapContract = (await app.getFixedSwapContract({
        tokenAddress: ERC20TokenAddress,
      })) as FixedSwapContract;
      tokenPurchaseAmount = 0.015;

      const testSwapWithVesting = async (
        duration: number,
        schedules: number[],
        editVesting = false
      ) => {
        const startDate = new Date((currentTime + 3 * 60) * 1000);
        const endDate = new Date((currentTime + 8 * 60) * 1000);
        /* Deploy */
        let res = await swapContract.deploy({
          tradeValue,
          tokensForSale: tokenFundAmount,
          isTokenSwapAtomic: false,
          individualMaximumAmount: tokenFundAmount,
          startDate, // 3 mins
          endDate, // 8 mins
          hasWhitelisting: false,
          vestingSchedule: !editVesting ? schedules : [],
          vestingCliff: 0,
          vestingDuration: !editVesting ? duration : 0,
        });
        contractAddress = swapContract.getAddress();
        expect(res).to.not.equal(false);
        const info = await swapContract.getDistributionInformation();
        expect(info).to.not.equal(false);

        if (editVesting) {
          await swapContract.setVesting({
            vestingSchedule: schedules,
            vestingStart: endDate,
            vestingCliff: 0,
            vestingDuration: duration,
          });
        }

        await swapContract.approveFundERC20({ tokenAmount: tokenFundAmount });
        await swapContract.fund({ tokenAmount: tokenFundAmount });
        await forwardTime(3 * 60);
        res = await swapContract.swap({ tokenAmount: tokenPurchaseAmount });
        expect(res).to.not.equal(false);
        const purchases = await swapContract.getAddressPurchaseIds({
          address: app.account.getAddress(),
        });

        let purchase = await swapContract.getPurchase({
          purchase_id: purchases[0],
        });
        expect(purchase.amountReedemed).to.equal(0);
        expect(purchase.amountLeftToRedeem).to.equal(0.015);

        await forwardTime(2 * 60);

        let failed = false;
        try {
          res = await swapContract.redeemTokens({ purchase_id: purchases[0] });
          expect(res).to.not.equal(false);
        } catch (e) {
          failed = true;
        }
        expect(failed).to.equal(true);
        await forwardTime(4 * 60);

        let i = 0;

        for (const schedule of schedules) {
          i++;
          res = await swapContract.redeemTokens({ purchase_id: purchases[0] });
          expect(res).to.not.equal(false);

          const tokens = await swapContract.tokensLeft();
          const tokensInVestingPeriod =
            ((tokenPurchaseAmount * schedule) / 100) * i;

          tokensLeft = Number(tokenFundAmount - tokensInVestingPeriod);
          expect(tokens).to.equal(0.015);

          purchase = await swapContract.getPurchase({
            purchase_id: purchases[0],
          });
          console.log(tokensInVestingPeriod);
          expect(purchase.amountReedemed).to.equal(tokensInVestingPeriod);
          expect(purchase.amountLeftToRedeem).to.equal(
            tokenPurchaseAmount - tokensInVestingPeriod
          );
          await forwardTime(duration);
        }

        await forwardTime(duration + 1);

        failed = false;
        try {
          res = await swapContract.redeemTokens({ purchase_id: purchases[0] });
          expect(res).to.not.equal(false);
        } catch (e) {
          failed = true;
        }
        expect(failed).to.equal(true);
      };

      const fiveMins = 5 * 60;
      const oneDay = 24 * 60 * 60;
      // Vesting in deploy
      await testSwapWithVesting(fiveMins, [50, 50]);
      await testSwapWithVesting(oneDay, [50, 50]);
      await testSwapWithVesting(fiveMins, [25, 25, 25, 25]);
      // Edit vesting
      await testSwapWithVesting(fiveMins, [50, 50], true);
      await testSwapWithVesting(fiveMins, [25, 25, 25, 25], true);
    })
  );
});