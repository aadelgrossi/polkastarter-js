import { idostaking } from '@interfaces';
import { Account, Contract, ERC20TokenContract } from '@models';
import { Client, Numbers } from '@utils';
import Web3 from 'web3';

type IDOStakingParams = {
  web3: Web3;
  contractAddress: string;
  contract: Contract;
  erc20TokenContract?: ERC20TokenContract;
  erc20TokenRewardsContract?: ERC20TokenContract;
};

type IDOStakingConstructorArgs = {
  web3: Web3;
  acc: Account;
  contractAddress?: string;
};
/**
 * IDO Staking Object
 * @constructor IDOStaking
 * @param {Web3} web3
 * @param {string} contractAddress The staking contract address.
 * @param {Account} acc
 */
class IDOStaking {
  web3: Web3;

  version: string;

  acc: Account;

  params: IDOStakingParams;

  private client: Client;

  constructor({ web3, contractAddress, acc }: IDOStakingConstructorArgs) {
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
      contract: new Contract(web3, idostaking, contractAddress),
    };
    this.client = new Client();
  }

  /**
   * @function deploy
   * @description Deploys the IDO Staking contracts
   * @param {string} owner Address of the owner
   * @param {string} rewardsDistribution Address of the distributor
   * @param {string} rewardsToken Address of the token we want to reward
   * @param {string} stakingToken Address of the token to be staked
   * @param {Integer} rewardsDuration Duration of the rewards
   * @returns {string} address The deployed contract address
   */
  deploy = async ({
    owner,
    rewardsDistribution,
    rewardsToken,
    stakingToken,
    rewardsDuration,
    callback = () => {},
  }) => {
    const params = [
      owner,
      rewardsDistribution,
      rewardsToken,
      stakingToken,
      rewardsDuration,
    ];
    const res = await this.__deploy(params, callback);
    this.params.contractAddress = res.contractAddress;
    return res.contractAddress;
  };

  __deploy = async (params, callback) => {
    return this.params.contract.deploy(
      this.acc,
      this.params.contract.getABI(),
      this.params.contract.getJSON().bytecode,
      params,
      callback
    );
  };

  /**
   * @function stake
   * @description Stakes tokens inside the stake contract
   * @param {Integer} amount Amount
   */
  stake = async ({ amount }) => {
    const amountToDecimals = Numbers.toSmartContractDecimals(
      amount,
      await this.getDecimals()
    );

    return await this.client.sendTx({
      web3: this.params.web3,
      acc: this.acc,
      contract: this.params.contract,
      f: this.params.contract.getContract().methods.stake(amountToDecimals),
    });
  };

  /**
   * @function approveStakeERC20
   * @param {Integer} tokenAmount
   * @description Approve the stake to use approved tokens
   */
  approveStakeERC20 = async ({ tokenAmount, callback }) => {
    const tokenContract = await this.getTokenContract();

    const response = tokenContract.approve({
      address: this.params.contractAddress,
      amount: tokenAmount,
      callback,
    });

    return response;
  };

  /**
   * @function isApproved
   * @description Verify if the address has approved the staking to deposit
   * @param {Integer} tokenAmount
   * @param {Address} address
   * @returns {Boolean}
   */
  isApproved = async ({ tokenAmount, address }) => {
    return (await this.getTokenContract()).isApproved({
      address,
      amount: tokenAmount,
      spenderAddress: this.params.contractAddress,
    });
  };

  /**
   * @function getAPY
   * @description Returns the APY that this pool is giving
   * @returns {Integer}
   */
  getAPY = async () => {
    const oneYear = 31556952;
    const duration = await this.params.contract
      .getContract()
      .methods.rewardsDuration()
      .call();
    const rewardPerToken = await this.params.contract
      .getContract()
      .methods.rewardPerToken()
      .call();

    const apy = (Number(rewardPerToken) * 100) / (Number(duration) / oneYear);

    return parseInt(apy.toString(), 10);
  };

  /**
   * @function withdraw
   * @param {Integer} amount
   * @description Withdraw tokens from the stake contract
   */
  withdraw = async ({ amount }) => {
    const { acc } = this;
    const { web3, contract } = this.params;
    const decimals = await this.getDecimals();
    const amountInDecimals = Numbers.toSmartContractDecimals(amount, decimals);
    const f = this.params.contract
      .getContract()
      .methods.withdraw(amountInDecimals);
    return await this.client.sendTx({ web3, acc, contract, f });
  };

  /**
   * @function withdrawAll
   * @description Withdraw all the tokens from the stake contract
   */
  withdrawAll = async () => {
    const f = this.getContractMethods().withdrawAll();

    return await this.client.sendTx({
      web3: this.params.web3,
      acc: this.acc,
      contract: this.params.contract,
      f,
    });
  };

  /**
   * @function exit
   * @description Claims all the rewards and withdraws all the staked tokens
   */
  exit = async () => {
    const f = this.getContractMethods().exit();
    return await this.client.sendTx({
      web3: this.params.web3,
      acc: this.acc,
      contract: this.params.contract,
      f,
    });
  };

  /**
   * @function claim
   * @description Claim rewards from the staking contract
   */
  claim = async () => {
    const f = this.getContractMethods().getReward();
    return await this.client.sendTx({
      web3: this.params.web3,
      acc: this.acc,
      contract: this.params.contract,
      f,
    });
  };

  /**
   * @function notifyRewardAmountSamePeriod
   * @description add (more) rewards token to current/future period
   * @param {Integer} amount
   */
  notifyRewardAmountSamePeriod = async ({ reward }) => {
    const decimals = await this.getRewardsDecimals();
    const amount = Numbers.toSmartContractDecimals(reward, decimals);
    const f = this.getContractMethods().notifyRewardAmountSamePeriod(amount);

    return await this.client.sendTx({
      web3: this.params.web3,
      acc: this.acc,
      contract: this.params.contract,
      f,
    });
  };

  /**
   * @function userAccumulatedRewards
   * @description Returns the accumulated rewards
   * @param {string} address
   * @returns {Integer} userAccumulatedRewards
   */
  userAccumulatedRewards = async ({ address }) => {
    const earned = await this.params.contract
      .getContract()
      .methods.earned(address)
      .call();
    const decimals = await this.getDecimals();

    return Numbers.fromDecimals(earned, decimals);
  };

  /**
   * @function lastTimeRewardApplicable
   * @description Get the last time rewards are applicable
   * @returns {Date}
   */
  async lastTimeRewardApplicable() {
    const lastTimeRewardApplicable = await this.getContractMethods()
      .lastTimeRewardApplicable()
      .call();

    return Numbers.fromSmartContractTimeToMinutes(lastTimeRewardApplicable);
  }

  /**
   * @function totalStaked
   * @description Returns the total stake
   * @returns {Integer} totalStakeAmount
   */
  totalStaked = async () => {
    const totalSupply = await this.getContractMethods().totalSupply().call();
    const decimals = await this.getDecimals();

    return Numbers.fromDecimals(totalSupply, decimals);
  };

  /**
   * @function stakeAmount
   * @description Returns the stake amount for a wallet
   * @param {string} address
   * @returns {Integer} stakeAmount
   */
  stakeAmount = async ({ address }) => {
    const balanceOf = await this.getContractMethods().balanceOf(address).call();
    const decimals = await this.getDecimals();
    return Numbers.fromDecimals(balanceOf, decimals);
  };

  /**
   * @function setTokenSaleAddress
   * @description Sets the token sale address
   * @param {string} address
   */
  setTokenSaleAddress = async ({ address }) => {
    const { acc } = this;
    const { web3, contract } = this.params;
    const f = this.getContractMethods().setTokenSaleAddress(address);

    await this.client.sendTx({ web3, acc, contract, f });
    return true;
  };

  getDecimals = async () => {
    const tokenContract = await this.getTokenContract();
    return tokenContract.getDecimals();
  };

  getTokenContract = async () => {
    const contractAddress = (await this.getContractMethods()
      .stakingToken()
      .call()) as string;

    if (!this.params.erc20TokenContract) {
      this.params.erc20TokenContract = new ERC20TokenContract({
        web3: this.params.web3,
        contractAddress,
        acc: this.acc,
      });
    }

    return this.params.erc20TokenContract;
  };

  getRewardsDecimals = async () => {
    return (await this.getRewardsTokenContract()).getDecimals();
  };

  getRewardsTokenContract = async () => {
    const contractAddress = await this.getContractMethods()
      .rewardsToken()
      .call();

    if (!this.params.erc20TokenRewardsContract) {
      this.params.erc20TokenRewardsContract = new ERC20TokenContract({
        web3: this.params.web3,
        contractAddress,
        acc: this.acc,
      });
    }
    return this.params.erc20TokenRewardsContract;
  };

  getContractMethods() {
    return this.params.contract.getContract().methods;
  }
}

export default IDOStaking;
