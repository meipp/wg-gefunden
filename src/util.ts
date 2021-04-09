import axios from "axios";
import { Selector } from "./selector";

const concat = <A>(as: A[][]): A[] => {
  return ([] as A[]).concat(...as);
};

const sleep = async (seconds: number) => {
  return new Promise((r) => setTimeout(r, seconds * 1000));
};

const selectorFromURL = async <A>(
  url: string,
  callback: (data: Selector) => A,
  retries: number = 2,
  seconds: number = 60
): Promise<A | "captcha"> => {
  const { status, statusText, data } = await axios.get(url);
  if (status !== 200) {
    throw new Error(`Request failed with status code ${status}: ${statusText}`);
  }

  const sel = Selector.from(data);
  if (sel.$(".g-recaptcha").exists()) {
    if (retries === 0) {
      console.error(`Encountered captcha while loading ${url}. Terminating`);
      return "captcha";
    } else {
      console.error(
        `Encountered captcha while loading ${url}. Retrying in ${seconds} seconds...`
      );
      await sleep(seconds);
      return selectorFromURL(url, callback, retries - 1, seconds);
    }
  }
  return callback(sel);
};

export { concat, sleep, selectorFromURL };
