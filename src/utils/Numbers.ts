/* eslint-disable func-names */
/* eslint-disable no-plusplus */
/* eslint-disable no-extend-native */

import accounting from 'accounting';
import dayjs from 'dayjs';
import Decimal from 'decimal.js';
import { create, all } from 'mathjs';
import moment, { MomentInputObject } from 'moment';

Number.prototype.noExponents = function (this: number) {
  const data = String(this).split(/[eE]/);
  if (data.length === 1) return data[0];

  let z = '';
  const sign = this < 0 ? '-' : '';
  const str = data[0].replace('.', '');
  let mag = Number(data[1]) + 1;

  if (mag < 0) {
    z = `${sign}0.`;
    while (mag++) z += '0';
    return z + str.replace(/^\\-/, '');
  }
  mag -= str.length;
  while (mag--) z += '0';
  return str + z;
};

export const noExponents = (value: number) => {
  const data = String(this).split(/[eE]/);
  if (data.length === 1) return data[0];

  let z = '';
  const sign = value < 0 ? '-' : '';
  const str = data[0].replace('.', '');
  let mag = Number(data[1]) + 1;

  if (mag < 0) {
    z = `${sign}0.`;
    while (mag++) z += '0';
    return z + str.replace(/^\\-/, '');
  }
  mag -= str.length;
  while (mag--) z += '0';
  return str + z;
};

const math = create(all, {
  number: 'BigNumber',
  precision: 64,
});

/**
 * Numbers object
 * @constructor Numbers
 */
class Numbers {
  fromDayMonthYear = (date: MomentInputObject) => {
    const mom = moment().dayOfYear(date.day);
    mom.set('hour', date.hour);
    mom.set('year', date.year);
    return mom.format('ddd, hA');
  };

  fromSmartContractTimeToMinutes = (time: number) => {
    return dayjs.unix(time).toDate();
  };

  fromMinutesToSmartContracTime = (time: number) => {
    return time;
  };

  fromHex = (hex: number) => {
    return hex.toString();
  };

  toFloat = (value: string) => {
    return parseFloat(parseFloat(value).toFixed(2));
  };

  timeToSmartContractTime = (time: number) => {
    const dividedByThousand = new Date(time).getTime() / 1000;
    return parseInt(dividedByThousand.toString(), 10);
  };

  toDate = (date: MomentInputObject) => {
    const mom = moment().dayOfYear(date.day);
    mom.set('hour', date.hour);
    mom.set('year', date.year);
    return mom.unix();
  };

  toMoney = (number: number) => {
    const _0xbea8 = [
      '\x45\x55\x52',
      '\x25\x76',
      '\x66\x6F\x72\x6D\x61\x74\x4D\x6F\x6E\x65\x79',
    ];
    return accounting[_0xbea8[2]](number, {
      symbol: _0xbea8[0],
      format: _0xbea8[1],
    });
  };

  formatNumber = (value: number) => {
    return accounting.formatNumber(value);
  };

  /**
   * @function toSmartContractDecimals
   * @description Converts a "human" number to the minimum unit.
   * @param {Float} value The number that you want to convert
   * @param {Integer} decimals Number of decimals
   * @returns {string}
   */
  toSmartContractDecimals = (
    value: Decimal | number,
    decimals: number
  ): string => {
    return math
      .chain(math.bignumber(value))
      .multiply(math.bignumber(10 ** decimals))
      .done()
      .toFixed(0);
  };

  /**
   * @function fromDecimals
   * @description Converts a number from his minimum unit to a human readable one.
   * @param {Float} value The number that you want to convert
   * @param {Integer} decimals Number of decimals
   * @returns {string}
   */
  fromDecimals = (value: any, decimals: number) => {
    if (!value) return 0;

    const result = math
      .chain(math.bignumber(value.toString()))
      .divide(math.bignumber(10 ** decimals))
      .toString();

    return Number(result);
  };

  fromExponential = (x: number) => {
    let result = x;

    if (Math.abs(x) < 1.0) {
      const e = parseInt(x.toString().split('e-')[1], 10);

      if (e) {
        result *= 10 ** (e - 1);
        result = Number(
          `0.${new Array(e).join('0')}${x.toString().substring(2)}`
        );
      }
    } else {
      let e = parseInt(x.toString().split('+')[1], 10);
      if (e > 20) {
        e -= 20;
        result /= 10 ** e;
        result += Number(new Array(e + 1).join('0'));
      }
    }
    return result;
  };
}

export default new Numbers();
