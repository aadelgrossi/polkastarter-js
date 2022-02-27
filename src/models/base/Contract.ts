import Web3 from 'web3';
import { TransactionReceipt, TransactionConfig } from 'web3-core';
import { Account as Web3Account } from 'web3-eth-accounts';
import { Contract as Web3Contract } from 'web3-eth-contract';
import { AbiItem } from 'web3-utils';

import Account from './Account';

type MetaMaskDeployArgs = {
  byteCode: string;
  acc: string;
  args: any[];
  callback?: (args: any) => void;
};

class Contract {
  private web3: Web3;

  address: string;

  private json: any;

  private abi: AbiItem;

  private contract: Web3Contract;

  constructor(web3: Web3, contract_json: any, address?: string) {
    this.web3 = web3;
    this.address = address;
    this.json = contract_json;
    this.abi = contract_json.abi;
    this.contract = new web3.eth.Contract(contract_json.abi, address);
  }

  deploy = async (
    account: Account,
    abi: any,
    byteCode: string,
    args?: any[],
    callback?: () => void
  ) => {
    try {
      let res: TransactionReceipt;
      this.contract = new this.web3.eth.Contract(abi);
      if (account) {
        const data = this.contract
          .deploy({
            data: byteCode,
            arguments: args,
          })
          .encodeABI();

        const txSigned = await account.getAccount().signTransaction({
          data,
          from: account.getAddress(),
          gas: 6913388,
        });

        res = await this.web3.eth.sendSignedTransaction(
          txSigned.rawTransaction
        );
      } else {
        const accounts = await this.web3.eth.getAccounts();
        res = await this.__metamaskDeploy({
          byteCode,
          args,
          acc: accounts[0],
          callback,
        });
      }
      this.address = res.contractAddress;
      return res;
    } catch (err) {
      console.log('err', err);
      throw err;
    }
  };

  __metamaskDeploy = async ({
    byteCode,
    args,
    acc,
    callback,
  }: MetaMaskDeployArgs) => {
    const response = new Promise<TransactionReceipt>((resolve, reject) => {
      const contract = this.getContract();

      contract
        .deploy({ data: byteCode, arguments: args })
        .send({ from: acc })
        .on('confirmation', (confirmationNumber, receipt) => {
          callback(confirmationNumber);
          if (confirmationNumber > 0) {
            resolve(receipt);
          }
        })
        .on('error', (err) => {
          reject(err);
        });
    });

    return response;
  };

  use = async (contract_json: any, address: string) => {
    this.json = contract_json;
    this.abi = contract_json.abi;
    this.address = address || this.address;
    this.contract = new this.web3.eth.Contract(contract_json.abi, this.address);
  };

  send = async (
    account: Web3Account,
    byteCode: string,
    value = '0x0',
    callback = (_args: any) => {}
  ) => {
    return new Promise(async (resolve, reject) => {
      const tx: TransactionConfig = {
        data: byteCode,
        from: account.address,
        to: this.address,
        gas: 4430000,
        gasPrice: 25000000000,
        value: value || '0x0',
      };

      const result = await account.signTransaction(tx);

      this.web3.eth
        .sendSignedTransaction(result.rawTransaction)
        .on('confirmation', (confirmationNumber, receipt) => {
          callback(confirmationNumber);
          if (confirmationNumber > 0) {
            resolve(receipt);
          }
        })
        .on('error', (err) => {
          reject(err);
        });
    });
  };

  getContract = () => this.contract;

  getABI = () => this.abi;

  getJSON = () => this.json;

  getAddress = () => this.address;
}

export default Contract;
