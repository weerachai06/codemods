// Enable debug logging
const debug = true;
export const log = (...args: any[]) => {
  if (debug) console.log("\x1b[36m[DEBUG]\x1b[0m", ...args);
};
