import Web3 from 'web3';
import { TransactionReceipt, TransactionConfig } from 'web3-core';
import { Account as Web3Account } from 'web3-eth-accounts';

interface Account {
  getBalance: () => Promise<string>;
  getAddress: () => string;
  getAccount: () => Web3Account;
  getPrivateKey: () => string;
  sendEther: (
    amount: number,
    address: string,
    data: string | null
  ) => Promise<TransactionReceipt>;
}

class AccountImpl implements Account {
  private web3: Web3;

  private account: Web3Account;

  constructor(web3: Web3, account: Web3Account) {
    this.web3 = web3;
    this.account = account;
  }

  getBalance = async () => {
    const address = this.getAddress();
    const wei = await this.web3.eth.getBalance(address);
    return this.web3.utils.fromWei(wei, 'ether');
  };

  getAddress = () => this.account.address;

  getPrivateKey = () => this.account.privateKey;

  getAccount = () => this.account;

  sendEther = async (amount: number, address: string, data: string | null) => {
    const tx: TransactionConfig = {
      data,
      from: this.getAddress(),
      to: address,
      gas: 443000,
      value: amount,
    };
    const result = await this.account.signTransaction(tx);
    const transaction = await this.web3.eth.sendSignedTransaction(
      result.rawTransaction
    );

    return transaction;
  };
}

export default AccountImpl;
