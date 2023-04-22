const setupEnvAccess = () => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { config } = require('dotenv');
    config();
  } catch {}
};

setupEnvAccess();

export const getVar = (name: string, defaultValue: string = ''): string => process.env[name] ?? defaultValue;

const nodeEnvs = ['dev', 'test', 'prod'] as const;
export type NodeEnv = typeof nodeEnvs[number];

const isNodeEnv = (val: string): val is NodeEnv => nodeEnvs.includes(val as never);

export const getNodeEnv = (): NodeEnv => {
  const rawValue = getVar('NODE_ENV');

  return isNodeEnv(rawValue) ? rawValue : 'dev';
};