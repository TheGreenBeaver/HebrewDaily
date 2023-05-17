import isError from 'lodash/isError';
import isFunction from 'lodash/isFunction';
import isObject from 'lodash/isObject';
import isString from 'lodash/isString';

export const decodeHtml = (text: string): string =>
  text.replace(/&#\d+;/g, charCode => String.fromCharCode(+charCode.substring(2, charCode.length - 1)));

export const getErrorString = (e: unknown): string => {
  if (isString(e)) {
    return e;
  }

  if (isError(e)) {
    return e.message;
  }

  if (isObject(e) && 'toString' in e && isFunction(e.toString)) {
    return e.toString();
  }

  try {
    return JSON.stringify(e);
  } catch {
    return 'Unknown error';
  }
};