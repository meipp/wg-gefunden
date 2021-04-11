import { Selector } from "./selector";
import { request, rotateIP } from "./async-tor-request";

const concat = <A>(as: A[][]): A[] => {
  return ([] as A[]).concat(...as);
};

const sleep = async (seconds: number) => {
  return new Promise((r) => setTimeout(r, seconds * 1000));
};

const selectorFromURL = async <A>(
  url: string,
  callback: (data: Selector) => A
): Promise<A> => {
  const { status, statusText, data } = await request(url);
  if (status !== 200) {
    throw new Error(`Request failed with status code ${status}: ${statusText}`);
  }

  const sel = Selector.from(data);
  if (sel.$(".g-recaptcha").exists()) {
    console.error(`Encountered captcha while loading ${url}. Rotating IP...`);
    await rotateIP();
    return selectorFromURL(url, callback);
  } else {
    return callback(sel);
  }
};

export { concat, sleep, selectorFromURL };
