import Web3 from 'web3';

import Account from '../models/base/Account';
import Contract from '../models/base/Contract';
/* istanbul ignore file */

/**
 * Client utils object
 * @constructor Network
 */

type MetamaskCallArgs = {
  f: any;
  acc: string;
  value: string | number;
  callback: (value: any) => void;
};

type SendTxArgs = {
  web3: Web3;
  acc: Account;
  contract: Contract;
  f: any;
  call?: boolean;
  value?: string;
  callback?: () => void;
};

class Client {
  metamaskCall = async ({
    f,
    acc,
    value,
    callback = (_value: any) => {},
  }: MetamaskCallArgs) => {
    return new Promise((resolve, reject) => {
      // Detect possible error on tx
      f.estimateGas({ gas: 5000000 }, (_error, gasAmount) => {
        // if(error){reject("Transaction will fail : " + error);}
        if (gasAmount >= 5000000) {
          reject(new Error('Transaction will fail, too much gas'));
        }

        // all alright
        f.send({
          from: acc,
          value,
        })
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
    });
  };

  sendTx = async ({
    web3,
    acc,
    contract,
    f,
    call = false,
    value = '0',
    callback = () => {},
  }: SendTxArgs) => {
    if (!acc && !call) {
      const accounts = await web3.eth.getAccounts();
      return this.metamaskCall({ f, acc: accounts[0], value, callback });
    }

    if (acc && !call) {
      const data = f.encodeABI();
      return contract.send(acc.getAccount(), data, value);
    }

    if (acc && call) {
      const response = await f.call({ from: acc.getAddress() });
      return response;
    }

    const response = await f.call();
    return response;
  };
}
export default Client;
