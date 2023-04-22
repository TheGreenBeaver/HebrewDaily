export const decodeHtml = (text: string): string =>
  text.replace(/&#\d+;/g, charCode => String.fromCharCode(+charCode.substring(2, charCode.length - 1)));