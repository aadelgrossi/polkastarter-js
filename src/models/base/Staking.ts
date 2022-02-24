import Web3 from 'web3';

/* eslint-disable @typescript-eslint/return-await */
/* eslint-disable no-param-reassign */
/* eslint-disable no-useless-catch */
import {
  stakingAddresses,
  stakingTestAddresses,
  tokenAddresses,
  tokenTestAddresses,
} from '../../constants/addresses';
import { staking } from '../../interfaces';
import { Chains, Client, Numbers } from '../../utils';
import Account from './Account';
import Contract from './Contract';
import ERC20TokenContract from './ERC20TokenContract';

/**
 * Staking Object
 * @constructor Staking
 * @param {Web3} web3
 * @param {string=} contractAddress The staking contract address. (Default: Predefined addresses depending on the network)
 * @param {Account} acc
 * @param {string=} tokenAddress The staking token address. (Default: Predefined addresses depending on the network)
 * @param {(ETH|BSC|MATIC|DOT)=} network The network where the staking contract is. (Default: ETH)
 * @param {Boolean=} test ? Specifies if we're on test env (Default: false)
 */

type StakeArgs = { amount: number };
type AddressArgs = { address: string };
type ApproveStakeERC20Args = {
  tokenAmount: number;
  callback?: (args?: any) => void;
};
type IsApprovedArgs = { tokenAmount: string | number; address: string };
type WithdrawArgs = { amount: number };

type StakingParams = {
  web3: Web3;
  contractAddress: string;
  contract: Contract;
  erc20TokenContract?: ERC20TokenContract;
};

class Staking {
  private web3: Web3;

  private version: string;

  private acc: Account;

  private client: Client;

  private decimals = 18;

  params: StakingParams;

  constructor({
    web3,
    contractAddress,
    acc,
    tokenAddress,
    network = 'ETH',
    test = false,
  }) {
    if (!web3) {
      throw new Error('Please provide a valid web3 provider');
    }

    Chains.checkIfNetworkIsSupported(network);
    this.web3 = web3;
    this.version = '2.0';
    if (acc) {
      this.acc = acc;
    }

    if (!contractAddress) {
      contractAddress = test
        ? stakingTestAddresses[network]
        : stakingAddresses[network];

      if (!contractAddress) {
        throw new Error(`Staking not available on the network ${network}`);
      }
    }

    this.params = {
      web3,
      contractAddress,
      contract: new Contract(web3, staking, contractAddress),
    };

    if (!tokenAddress) {
      tokenAddress = test
        ? tokenTestAddresses[network]
        : tokenAddresses[network];
      if (!tokenAddress) {
        throw new Error(`Token not available on the network ${network}`);
      }
    }

    this.params.erc20TokenContract = new ERC20TokenContract({
      web3,
      contractAddress: tokenAddress,
      acc,
    });
    this.client = new Client();
  }

  /**
   * @function stake
   * @description Stakes tokens inside the stake contract
   * @param {Integer} amount Amount
   */
  stake = async ({ amount }: StakeArgs) => {
    const amountInDecimals = Numbers.toSmartContractDecimals(
      amount,
      this.decimals
    );
    try {
      return await this.client.sendTx({
        web3: this.params.web3,
        acc: this.acc,
        contract: this.params.contract,
        f: this.params.contract.getContract().methods.stake(amountInDecimals),
      });
    } catch (err) {
      throw err;
    }
  };

  /**
   * @function approveStakeERC20
   * @param {Integer} tokenAmount
   * @description Approve the stake to use approved tokens
   */
  approveStakeERC20 = async ({
    tokenAmount,
    callback,
  }: ApproveStakeERC20Args) => {
    return await this.getTokenContract().approve({
      address: this.params.contractAddress,
      amount: tokenAmount,
      callback,
    });
  };

  /**
   * @function isApproved
   * @description Verify if the address has approved the staking to deposit
   * @param {Integer} tokenAmount
   * @param {Address} address
   * @returns {Boolean}
   */
  isApproved = async ({ tokenAmount, address }: IsApprovedArgs) => {
    return await this.getTokenContract().isApproved({
      address,
      amount: tokenAmount,
      spenderAddress: this.params.contractAddress,
    });
  };

  /**
   * @function withdraw
   * @param {Integer} amount
   * @description Withdraw tokens from the stake contract
   */
  withdraw = async ({ amount }: WithdrawArgs) => {
    const amountInDecimals = Numbers.toSmartContractDecimals(
      amount,
      this.decimals
    );
    try {
      const { web3, acc, params } = this;
      return await this.client.sendTx({
        web3,
        acc,
        contract: params.contract,
        f: params.contract.getContract().methods.withdraw(amountInDecimals),
      });
    } catch (err) {
      throw err;
    }
  };

  /**
   * @function withdrawAll
   * @description Withdraw all the tokens from the stake contract
   */
  withdrawAll = async () => {
    try {
      const { web3, acc, params } = this;
      return await this.client.sendTx({
        web3,
        acc,
        contract: params.contract,
        f: params.contract.getContract().methods.withdrawAll(),
      });
    } catch (err) {
      throw err;
    }
  };

  /**
   * @function claim
   * @description Claim rewards from the staking contract
   */
  claim = async () => {
    try {
      const { web3, acc, params } = this;

      return await this.client.sendTx({
        web3,
        acc,
        contract: params.contract,
        f: params.contract.getContract().methods.claim(),
      });
    } catch (err) {
      throw err;
    }
  };

  /**
   * @function userAccumulatedRewards
   * @description Returns the accumulated rewards
   * @param {string} address
   * @returns {Integer} userAccumulatedRewards
   */
  userAccumulatedRewards = async ({
    address,
  }: AddressArgs): Promise<number> => {
    return await this.params.contract
      .getContract()
      .methods.userAccumulatedRewards(address)
      .call();
  };

  /**
   * @function stakeTime
   * @description Returns the stake time for a wallet
   * @param {string} address
   * @returns {Integer} stakeTime
   */
  stakeTime = async ({ address }: AddressArgs): Promise<number> => {
    return await this.params.contract
      .getContract()
      .methods.stakeTime(address)
      .call();
  };

  /**
   * @function lockTimePeriod
   * @description Returns the lock time perdio
   * @returns {Integer} lockTimePeriod
   */
  getLockTimePeriod = async (): Promise<number> => {
    return await this.params.contract
      .getContract()
      .methods.lockTimePeriod()
      .call();
  };

  /**
   * @function getUnlockTime
   * @description Returns the stake time for a wallet
   * @param {string} address
   * @returns {Integer} unlockTime
   */
  getUnlockTime = async ({ address }: AddressArgs): Promise<number> => {
    return await this.params.contract
      .getContract()
      .methods.getUnlockTime(address)
      .call();
  };

  /**
   * @function stakeAmount
   * @description Returns the stake amount for a wallet
   * @param {string} address
   * @returns {Integer} stakeAmount
   */
  stakeAmount = async ({ address }: AddressArgs) => {
    const value = await this.params.contract
      .getContract()
      .methods.stakeAmount(address)
      .call();

    const result = Numbers.fromDecimals(value, this.decimals);
    return result;
  };

  getTokenContract() {
    return this.params.erc20TokenContract;
  }
}

export default Staking;
