import  Web3  from 'web3';

declare global {
  namespace NodeJS {
    interface Global {
        IS_TEST: boolean;
    }
  }
}

declare global {
  interface Window {
    ethereum: any
    web3: Web3
  }
}

declare global {
  interface Number {
      noExponents(this: number): string;
  }
}

export {};
