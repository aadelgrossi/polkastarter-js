import { ierc20 } from '@interfaces';
import { Client, Numbers } from '@utils';
import Web3 from 'web3';

import Account from './Account';
import Contract from './Contract';

let self;

type ERC20TokenContractParams = {
  web3: Web3;
  contractAddress: string;
  contract: Contract;
  decimals: number | null;
};

type ERC20TokenContractConstructorArgs = {
  web3: Web3;
  contractAddress: string;
  acc?: Account;
};

class ERC20TokenContract {
  private acc: Account;

  params: ERC20TokenContractParams;

  private client: Client;

  constructor({
    contractAddress,
    web3,
    acc,
  }: ERC20TokenContractConstructorArgs) {
    if (acc) {
      this.acc = acc;
    }
    this.params = {
      web3,
      contractAddress,
      contract: new Contract(web3, ierc20, contractAddress),
      decimals: null,
    };

    self = {
      contract: new Contract(web3, ierc20, contractAddress),
    };
    this.client = new Client();
  }

  __assert() {
    this.params.contract.use(ierc20, this.getAddress());
  }

  getContract() {
    return this.params.contract.getContract();
  }

  getAddress() {
    return this.params.contractAddress;
  }

  setNewOwner = async ({ address }) => {
    try {
      return await this.client.sendTx({
        web3: this.params.web3,
        acc: this.acc,
        contract: this.params.contract,
        f: this.params.contract
          .getContract()
          .methods.transferOwnership(address),
      });
    } catch (err) {
      console.log(err);
    }
  };

  async transferTokenAmount({ toAddress, tokenAmount }) {
    const amountWithDecimals = Numbers.toSmartContractDecimals(
      tokenAmount,
      await this.getDecimals()
    );
    return this.client.sendTx({
      web3: this.params.web3,
      acc: this.acc,
      contract: this.params.contract,
      f: this.params.contract
        .getContract()
        .methods.transfer(toAddress, amountWithDecimals),
    });
  }

  async getTokenAmount(address) {
    return Numbers.fromDecimals(
      await this.getContract().methods.balanceOf(address).call(),
      await this.getDecimals()
    );
  }

  async totalSupply() {
    const response = await this.getContract().methods.totalSupply().call();
    return response;
  }

  getABI() {
    return self.contract;
  }

  async getDecimals() {
    if (!this.params.decimals) {
      this.params.decimals = parseInt(
        await this.getContract().methods.decimals().call(),
        10
      );
    }
    return this.params.decimals;
  }

  async isApproved({ address, amount, spenderAddress, callback = () => {} }) {
    let newAmount = amount;
    const res = await this.client.sendTx({
      web3: this.params.web3,
      acc: this.acc,
      contract: this.params.contract,
      f: this.params.contract
        .getContract()
        .methods.allowance(address, spenderAddress),
      call: true,
      callback,
    });

    const approvedAmount = Numbers.fromDecimals(res, await this.getDecimals());

    if (typeof amount === 'string') {
      newAmount = parseFloat(amount);
    }

    return approvedAmount >= newAmount;
  }

  async approve({ address, amount, callback }) {
    const amountWithDecimals = Numbers.toSmartContractDecimals(
      amount,
      await this.getDecimals()
    );

    const f = this.params.contract
      .getContract()
      .methods.approve(address, amountWithDecimals);
    return this.client.sendTx({
      web3: this.params.web3,
      acc: this.acc,
      contract: this.params.contract,
      f,
      callback,
    });
  }
}

export default ERC20TokenContract;
