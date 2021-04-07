import axios from "axios";
import { uniq } from "lodash";
import { assert_regex } from "./regex";
import { Selector } from "./selector";
import { concat } from "./util";

const selectorFromURL = async <A>(
  url: string,
  callback: (data: Selector) => A
): Promise<A> => {
  const { status, statusText, data } = await axios.get(url);
  if (status !== 200) {
    throw new Error(`Request failed with status code ${status}: ${statusText}`);
  }
  return callback(Selector.from(data));
};

// For some reason it is not possible to generate query urls with specific page numbers in them.
// Hence, querying is done linearly by pressing the "next page" button each time.
const query_ads_linearly = async (query_url: string): Promise<string[]> => {
  return await selectorFromURL(query_url, async (sel) => {
    // If there is only one page, the pagination bar will be omitted
    // and Math.max() would be called with zero arguments.
    // Therefore, 1 is added as an argument to the calls to Math.max().
    const current_page = Math.max(
      1,
      ...sel
        .$(".pagination .active")
        .textContent()
        .map((s) => s.trim())
        .map((s) => parseInt(s, 10))
    );

    const number_of_pages = Math.max(
      1,
      ...sel
        .$(".pagination .a-pagination, .pagination .active")
        .textContent()
        .map((s) => s.trim())
        .map((s) => parseInt(s, 10))
    );

    const h1 = sel.$("h1").single().textContent().trim();
    const number_of_offers = assert_regex(h1, /:\s+(\d+)\s+Angebote?$/, 1);

    console.log(
      `Page ${current_page} of ${number_of_pages} / ${number_of_offers} offer(s) in total`
    );

    const ads = sel
      .$(".offer_list_item h3 a")
      .attribute("href")
      .map((href) => `https://www.wg-gesucht.de/${href}`);

    const next_page = sel
      .$('.pagination a:not([href=""])')
      .filter((e) => e.textContent?.trim() === "»")
      .attribute("href")
      .map((href) => `https://www.wg-gesucht.de/${href}`);

    return ads.concat(
      ...(await Promise.all(next_page.map(query_ads_linearly)))
    );
  });
};

const main = async () => {
  // Requires a url of the form https://wg-gesucht.de/wg-zimmer-in-Berlin.8.0.1.0.html?...
  const [_, __, url] = process.argv;
  if (!url) {
    throw new Error("URL required");
  }

  const ads = uniq(await query_ads_linearly(url));
  console.log(`${ads.length} offer(s) found`);
  console.log(ads);
};

main();
