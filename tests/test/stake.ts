import { ierc20, staking } from '@interfaces';
import { Staking } from '@models';
import { mochaAsync } from '@test-utils';
import chai from 'chai';
import * as ethers from 'ethers';
import ganache from 'ganache-core';
import Web3 from 'web3';

import { Application } from '../../src';

require('dotenv').config();

const userPrivateKey =
  '0x7f76de05082c4d578219ca35a905f8debe922f1f00b99315ebf0706afc97f132';

const { expect } = chai;

context('Staking Contract', () => {
  let ERC20TokenAddress: string;
  let StakingAddress: string;
  let stakeContract: Staking;
  let app: Application;
  let ethersProvider: ethers.ethers.providers.Web3Provider;
  let _currentTime: number;
  const lockTime = 10 * 60; // 10 minutes

  const forwardTime = async (time) => {
    // "Roads? Where we’re going, we don’t need roads."
    const date = new Date().getTime() / 1000;
    _currentTime =
      date + (await ethersProvider.send('evm_increaseTime', [time]));

    const ethersResult = await ethersProvider.send('evm_mine', []);
    return ethersResult;
  };

  before(
    mochaAsync(async () => {
      return new Promise<void>(async (resolve) => {
        // Instance Application using ganache
        const ganacheProvider = ganache.provider({
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

        const web3 = new Web3(<any>ganacheProvider);

        app = new Application({
          test: true,
          network: 'BSC',
          web3,
        });
        app.web3.eth.transactionConfirmationBlocks = 1;
        ethersProvider = new ethers.providers.Web3Provider(
          <any>ganacheProvider
        );

        // Deploy the ERC20
        /* @ts-ignore */
        const contract = new app.web3.eth.Contract(ierc20.abi, null, {
          data: ierc20.bytecode,
        });

        contract
          /* @ts-ignore */
          .deploy()
          .send({
            from: '0xe797860acFc4e06C1b2B96197a7dB1dFa518d5eB',
            gas: 4712388,
          })
          .on('confirmation', (_confirmationNumber, _receipt) => {
            ERC20TokenAddress = _receipt.contractAddress;
            // Deploy the stake contract
            const contractStake = new app.web3.eth.Contract(
              <any>staking.abi,
              null,
              /* @ts-ignore */
              {
                data: staking.bytecode,
              }
            );
            contractStake
              /* @ts-ignore */
              .deploy({
                arguments: [ERC20TokenAddress, `${lockTime}`],
              })
              .send({
                from: '0xe797860acFc4e06C1b2B96197a7dB1dFa518d5eB',
                gas: 4712388,
              })
              .on('confirmation', (confirmationNumber, receipt) => {
                StakingAddress = receipt.contractAddress;
                resolve();
              })
              .on('error', console.log);
          })
          .on('error', console.log);
      });
    })
  );

  it(
    'should automatically get addresses',
    mochaAsync(async () => {
      stakeContract = await app.getStaking({});
      expect(stakeContract).to.not.equal(false);
      expect(stakeContract.params.contractAddress).to.equal(
        '0x1621AEC5D5B2e6eC6D9B58399E9D5253AF86DF5f'
      );
      expect(
        stakeContract.params.erc20TokenContract.params.contractAddress
      ).to.equal('0xcfd314B14cAB8c3e36852A249EdcAa1D3Dd05055');
    })
  );

  it(
    'should get deployed contract',
    mochaAsync(async () => {
      stakeContract = await app.getStaking({
        contractAddress: StakingAddress,
        tokenAddress: ERC20TokenAddress,
      });
      expect(stakeContract).to.not.equal(false);
    })
  );

  it(
    'should return empty stake amount at start',
    mochaAsync(async () => {
      const stakedAmount = await stakeContract.stakeAmount({
        address: app.account.getAddress(),
      });
      expect(stakedAmount).to.equal(0);
    })
  );

  it(
    'should stake after approve',
    mochaAsync(async () => {
      let approval = await stakeContract.isApproved({
        address: app.account.getAddress(),
        tokenAmount: 1000,
      });
      expect(approval).to.equal(false);

      await stakeContract.approveStakeERC20({ tokenAmount: 1000 });

      approval = await stakeContract.isApproved({
        address: app.account.getAddress(),
        tokenAmount: '1000',
      });
      expect(approval).to.equal(true);

      expect(
        await stakeContract.isApproved({
          address: app.account.getAddress(),
          tokenAmount: 1000,
        })
      ).to.equal(true);

      await stakeContract.stake({ amount: 1000 });

      const res = (await stakeContract.stakeAmount({
        address: app.account.getAddress(),
      })) as number;
      expect(res).to.equal(1000);

      const stakeTime = await stakeContract.stakeTime({
        address: app.account.getAddress(),
      });
      const lockTimePeriod = await stakeContract.getLockTimePeriod();

      const unlockTime = stakeTime + lockTimePeriod;

      const stakeContractUnlockTime = (await stakeContract.getUnlockTime({
        address: app.account.getAddress(),
      })) as number;

      expect(stakeContractUnlockTime).to.equal(unlockTime);
    })
  );

  it(
    'should fail withdraw if we didnt reach time',
    mochaAsync(async () => {
      let failed = false;
      try {
        const response = await stakeContract.withdrawAll();
        expect(response).to.not.equal(false);
      } catch (e) {
        failed = true;
      }
      expect(failed).to.equal(true);
    })
  );

  it(
    'should withdraw after stake',
    mochaAsync(async () => {
      await forwardTime(lockTime + 30);
      await stakeContract.withdraw({ amount: 400 });

      let stakeAmount = await stakeContract.stakeAmount({
        address: app.account.getAddress(),
      });
      expect(stakeAmount).to.equal(600);

      await stakeContract.withdrawAll();

      stakeAmount = await stakeContract.stakeAmount({
        address: app.account.getAddress(),
      });
      expect(stakeAmount).to.equal(0);
    })
  );
});
