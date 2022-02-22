import Web3 from 'web3';
import Account from '../models/Account';
import Contract from '../models/Contract';
/* istanbul ignore file */

/**
 * Client utils object
 * @constructor Network
*/

type MetamaskCallArgs = {
	f: any,
	acc: string,
	value: string | number,
	callback: (value: any) => void
}

class Client {
    metamaskCall = async ({ f, acc, value, callback=(value: any)=> {} }: MetamaskCallArgs) => {
		return new Promise( (resolve, reject) => {
			// Detect possible error on tx
			f.estimateGas({gas: 5000000}, (error, gasAmount) => {
				//if(error){reject("Transaction will fail : " + error);}
				if(gasAmount >= 5000000){
					reject("Transaction will fail, too much gas");
				}

				// all alright
				f.send({
					from: acc,
					value: value,
				})
				.on("confirmation", (confirmationNumber, receipt) => {
					callback(confirmationNumber)
					if (confirmationNumber > 0) {
						resolve(receipt);
					}
				})
				.on("error", (err) => {
					reject(err);
				});
			});
		});
	};

	sendTx = async (
		web3: Web3,
		acc: Account,
		contract: Contract,
		f: any,
		call = false,
		value: string,
		callback = () => {} ) => {

		if (!acc && !call) {
			const accounts = await web3.eth.getAccounts();
			return await this.metamaskCall({ f, acc: accounts[0], value, callback });
		}

		if (acc && !call) {
			let data = f.encodeABI();
			return await contract.send(
				acc.getAccount(),
				data,
				value
			);
		}

		if (acc && call) {
			return await f.call({ from: acc.getAddress() });
		}

		return await f.call();
	};
}
export default Client;
