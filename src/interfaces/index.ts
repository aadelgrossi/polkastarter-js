import originalJson from './fixedswap.json';
import oldRedeemMethod from './oldRedeemMethod.json';

const updateFixedSwap = () => {
  originalJson.abi.push(oldRedeemMethod);
  return originalJson;
};

export const fixedswap = updateFixedSwap();
export { default as fixednftswap } from './fixednftswap.json';
export { default as swapv2 } from './fixedswapv2.json';
export { default as fixedswap_legacy } from './fixedswap_legacy.json';
export { default as ierc20 } from './ierc20token.json';
export { default as staking } from './staking.json';
export { default as idostaking } from './idostaking.json';
