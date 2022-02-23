import Decimal from 'decimal.js';
import * as ethers from 'ethers';

import Numbers from './Numbers';

/**
 * @typedef Signer
 * @type {object}
 * @property {Function} signMessage - Signs a message
 */

/**
 * @typedef SignedAddress
 * @type {object}
 * @property {string} address - Address.
 * @property {string} allocation - Max Allocation.
 * @property {string} signature - Signed Address
 */

type EthersSigner = ethers.ethers.Wallet;

type GenerateSignerAccountArgs = { password: string; entropy?: string };
type AddressFromAccountArgs = { accountJson: string; password: string };

type SignAddressesArgs = {
  addresses: string[];
  accountJson: string;
  accountMaxAllocations: Decimal[];
  decimals: number;
  contractAddress: string;
  password: string;
};

type VerifySignatureArgs = {
  signature: string;
  address: string;
  accountMaxAllocation: string;
  contractAddress: string;
  signerAddress: string;
};

type SignAddressesWithSignerArgs = {
  addresses: string[];
  accountJson: string;
  accountMaxAllocations: Decimal[];
  decimals: number;
  contractAddress: string;
  password: string;
  signer: EthersSigner;
};

type SignAddressArgs = {
  signer: EthersSigner;
  address: string;
  accountMaxAllocation: string;
  contractAddress: string;
};

type SignMessageArgs = { signer: EthersSigner; message: ethers.Bytes | string };

/**
 * Signer object
 * @constructor Signer
 */
class Signer {
  /**
   * @function generateSignerAccount
   * @description Generates a new private key for signing the whitelist addresses
   * @param {string} password Password for encryption
   * @param {string=} entropy Add more entropy
   * @returns {string} JSON Account
   */
  generateSignerAccount = async ({
    password,
    entropy,
  }: GenerateSignerAccountArgs) => {
    const wallet = ethers.Wallet.createRandom(entropy);
    return wallet.encrypt(password);
  };

  /**
   * @function getAddressFromAccount
   * @description Recovers an account given a json file
   * @param {string} accountJson Account in a json format
   * @param {string} password Password to unlock the account
   * @returns {string} Address
   */
  getAddressFromAccount = ({
    accountJson,
    password,
  }: AddressFromAccountArgs) => {
    const signer = ethers.Wallet.fromEncryptedJsonSync(accountJson, password);
    return signer.address;
  };

  /**
   * @function signAddresses
   * @description Signs an array of addresses. Will ignore malformed addresses.
   * @param {string[]} addresses List of addresses to sign
   * @param {string} accountJson Account in a json format
   * @param {number[]} accountMaxAllocations List of mac allocations in wei
   * @param {number} decimals Decimals for the max allocation
   * @param {string} contractAddress Pool
   * @param {string} password Password to unlock the account
   * @returns {SignedAddress[]} signedAddresses
   */
  signAddresses = async ({
    addresses,
    accountJson,
    password,
    accountMaxAllocations,
    contractAddress,
    decimals,
  }: SignAddressesArgs) => {
    const signer = ethers.Wallet.fromEncryptedJsonSync(accountJson, password);

    return this.signAddressesWithSigner({
      addresses,
      accountMaxAllocations,
      contractAddress,
      decimals,
      accountJson,
      password,
      signer,
    });
  };

  /**
   * @function signAddressesWithSigner
   * @description Signs an array of addresses. Will ignore malformed addresses.
   * @param {string[]} addresses List of addresses to sign
   * @param {number[]} accountMaxAllocations List of mac allocations in wei
   * @param {number} decimals Decimals for the max allocation
   * @param {string} contractAddress Pool
   * @param {Signer} signer Signer object
   * @returns {SignedAddress[]} signedAddresses
   */
  signAddressesWithSigner = async ({
    addresses,
    accountMaxAllocations,
    contractAddress,
    decimals,
    signer,
  }: SignAddressesWithSignerArgs) => {
    const signedAddresses = [];
    let processed = 0;
    let rejected = 0;

    addresses.map(async (address, index) => {
      const allocation = Numbers.toSmartContractDecimals(
        accountMaxAllocations[index],
        decimals
      );
      const result = await this._trySignAddress(
        signer,
        address,
        allocation,
        contractAddress
      );
      if (result) {
        signedAddresses.push({
          address,
          signature: result,
          allocation,
        });
        processed += 1;
      } else {
        rejected += 1;
      }
    });

    console.info(processed, 'lines successfully processed');
    console.info(rejected, 'lines rejected');
    return signedAddresses;
  };

  /**
   * @function signMessage
   * @description Signs a message given an account
   * @param {Signer} signer Signer
   * @param {string} message String to sign
   * @returns {string} signedString
   */
  signMessage = async ({ signer, message }: SignMessageArgs) => {
    return signer.signMessage(message);
  };

  /**
   * @function verifySignature
   * @description Verifies if an address has been signed with the signer address
   * @param {string} signature Signature
   * @param {string} address Address signed
   * @param {string} contractAddress Pool contract address
   * @param {string} accountMaxAllocation Max allocation
   * @param {string} signerAddress Address who signed the message
   * @returns {boolean} verified
   */
  verifySignature = async ({
    signature,
    address,
    accountMaxAllocation,
    contractAddress,
    signerAddress,
  }: VerifySignatureArgs) => {
    try {
      const actualAddress = ethers.utils.verifyMessage(
        this._addressToBytes32(address, accountMaxAllocation, contractAddress),
        signature
      );
      return signerAddress.toLowerCase() === actualAddress.toLowerCase();
    } catch (e) {
      return false;
    }
  };

  /**
   * @function signAddress
   * @description Signs a address given an account
   * @param {Signer} signer Signer object
   * @param {string} address Address to sign
   * @param {string} contractAddress Pool contract address
   * @param {string} accountMaxAllocation Max allocation
   * @returns {string} signedString
   */
  signAddress = async ({
    signer,
    address,
    accountMaxAllocation,
    contractAddress,
  }: SignAddressArgs) => {
    const message = this._addressToBytes32(
      address,
      accountMaxAllocation,
      contractAddress
    );
    return this.signMessage({ signer, message });
  };

  _trySignAddress = async (
    signer: EthersSigner,
    address: string,
    accountMaxAllocation: string,
    contractAddress: string
  ) => {
    const isAddress = ethers.utils.isAddress(address);
    const addressBigNumber = ethers.BigNumber.from(address).toNumber();

    if (isAddress && addressBigNumber !== 0) {
      return this.signAddress({
        signer,
        address,
        accountMaxAllocation,
        contractAddress,
      });
    }
    console.error('address not valid - ignored :', address);
    return '';
  };

  _addressToBytes32 = (address, accountMaxAllocation, contractAddress) => {
    const messageHash = ethers.utils.solidityKeccak256(
      ['address', 'uint256', 'address'],
      [address, accountMaxAllocation, contractAddress]
    );

    return ethers.utils.arrayify(messageHash);
  };
}

export default Signer;
