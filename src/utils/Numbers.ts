import { Decimal } from 'decimal.js';
import moment, {MomentInputObject} from 'moment'
import accounting from 'accounting'
import dayjs from 'dayjs'
import { create, all } from 'mathjs';

Number.prototype.noExponents = function (this: number) {
  const data = String(this).split(/[eE]/)
  if (data.length == 1) return data[0]

  var z = '',
    sign = this < 0 ? '-' : '',
    str = data[0].replace('.', ''),
    mag = Number(data[1]) + 1

  if (mag < 0) {
    z = sign + '0.'
    while (mag++) z += '0'
    return z + str.replace(/^\-/, '')
  }
  mag -= str.length
  while (mag--) z += '0'
  return str + z
}

/**
 * Numbers object
 * @constructor Numbers
 */
class Numbers {
  private readonly math = create(all, {
    number: 'BigNumber',
    precision: 64,
  });


  fromDayMonthYear = (date: MomentInputObject) => {
    let mom = moment().dayOfYear(date.day)
    mom.set('hour', date.hour)
    mom.set('year', date.year)
    return mom.format('ddd, hA')
  }

  fromSmartContractTimeToMinutes = (time: number) => {
    return dayjs.unix(time).toDate();
  }

  fromMinutesToSmartContracTime = (time: number) => {
    return time
  }

  fromHex = (hex: number) => {
    return hex.toString();
  }

  toFloat = (value: string) => {
    return parseFloat(parseFloat(value).toFixed(2))
  }

  timeToSmartContractTime = (time: number) => {
    const dividedByThousand = new Date(time).getTime() / 1000
    return parseInt(dividedByThousand.toString())
  }

  toDate = (date: MomentInputObject) => {
    let mom = moment().dayOfYear(date.day)
    mom.set('hour', date.hour)
    mom.set('year', date.year)
    return mom.unix()
  }

  toMoney = (number: number) => {
    var _0xbea8=["\x45\x55\x52","\x25\x76","\x66\x6F\x72\x6D\x61\x74\x4D\x6F\x6E\x65\x79"];
    return accounting[_0xbea8[2]](number, {
      symbol:_0xbea8[0],
      format:_0xbea8[1]
    });
  }

  formatNumber = (value: number) => {
    return accounting.formatNumber(value)
  }

  /**
	 * @function toSmartContractDecimals
	 * @description Converts a "human" number to the minimum unit.
   * @param {Float} value The number that you want to convert
	 * @param {Integer} decimals Number of decimals
	 * @returns {string}
	 */
  toSmartContractDecimals = (value: Decimal, decimals: number): string => {
    return this.math
      .chain(this.math.bignumber(value))
      .multiply(this.math.bignumber(10 ** decimals))
      .done()
      .toFixed(0);
  }

  /**
	 * @function fromDecimals
	 * @description Converts a number from his minimum unit to a human readable one.
   * @param {Float} value The number that you want to convert
	 * @param {Integer} decimals Number of decimals
	 * @returns {string}
	 */
  fromDecimals = (value: number | string, decimals: number) => {
    if (value == null) return 0;

    return this.math
      .chain(this.math.bignumber(value))
      .divide(this.math.bignumber(10 ** decimals))
      .toString();
  }

  fromExponential = (x: number) => {
    if (Math['abs'](x) < 1.0) {
      var e = parseInt(x.toString()['split']('e-')[1]);

      if (e) {
          x *= Math['pow'](10, e - 1);
          x = Number('0.' + new Array(e)['join']('0') + x.toString()['substring'](2))
      }
  } else {
      var e = parseInt(x.toString()['split']('+')[1]);
      if (e > 20) {
          e -= 20;
          x /= Math['pow'](10, e);
          x += Number(new Array(e + 1)['join']('0'))
      }
  };
    return x;
  }

}

export default new Numbers();

