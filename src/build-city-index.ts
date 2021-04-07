import axios from "axios";
import { Selector } from "./selector";

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

const id_from_url = (url: string): string => {
  const match = url.match(
    "^((https?://www.wg-gesucht.de)?/?)(anzeigen|wg-zimmer|1-zimmer-wohnungen||wohnungen|haeuser)-in-([^\\d]+)\\.(\\d+)(\\.\\d+\\.\\d+\\.\\d+)?\\.html$"
  );

  if (!match) {
    throw new Error(`Malformed url: ${url}`);
  }
  return match[5];
};

const discover_federal_state = async (state_url: string) => {
  return selectorFromURL(state_url, (sel) => {
    const index: any = {};

    const h1 = sel.$("h1").single().textContent();
    const state = h1.match(/^Leben und Wohnen in (.+)$/)?.[1] || null;

    const links = sel
      .$('a[href^="https://www.wg-gesucht.de/anzeigen-in-"]')
      .forEach((a) => {
        const city = a.innerHTML.trim();
        const href = a.getAttribute("href")!;
        const id = id_from_url(href);

        index[id] = { city, state, id };
      });
    return index;
  });
};

const discover_wohngemeinschaft = async () => {
  const url = "https://www.wg-gesucht.de/wohngemeinschaft.html";

  return selectorFromURL(url, (sel) => {
    const index: any = {};
    sel.$("a.titel_link").forEach((a) => {
      const city = a.innerHTML
        .trim()
        .replace(/^Wohnungsmarkt\s+/, "")
        .replace(/\s*:\s*$/, "");
      const href = a.getAttribute("href")!;
      const id = id_from_url(href);

      if (!id) {
        throw new Error("Cannot determine city id");
      }
      index[id] = { city, state: null, id };
    });
    return index;
  });
};

const main = async () => {
  const federal_state_urls = [
    "https://www.wg-gesucht.de/staedte-in-baden-wurttemberg.4.html",
    "https://www.wg-gesucht.de/staedte-in-bayern.3.html",
    "https://www.wg-gesucht.de/staedte-in-berlin.5.html",
    "https://www.wg-gesucht.de/staedte-in-brandenburg.6.html",
    "https://www.wg-gesucht.de/staedte-in-bremen.8.html",
    "https://www.wg-gesucht.de/staedte-in-hamburg.15.html",
    "https://www.wg-gesucht.de/staedte-in-hessen.10.html",
    "https://www.wg-gesucht.de/staedte-in-mecklenburg-vorpommern.14.html",
    "https://www.wg-gesucht.de/staedte-in-niedersachsen.7.html",
    "https://www.wg-gesucht.de/staedte-in-nordrhein-westfalen.2.html",
    "https://www.wg-gesucht.de/staedte-in-rheinland-pfalz.16.html",
    "https://www.wg-gesucht.de/staedte-in-saarland.17.html",
    "https://www.wg-gesucht.de/staedte-in-sachsen.9.html",
    "https://www.wg-gesucht.de/staedte-in-sachsen-anhalt.11.html",
    "https://www.wg-gesucht.de/staedte-in-schleswig-holstein.13.html",
    "https://www.wg-gesucht.de/staedte-in-thuringen.12.html",
  ];

  const dict: any = {};
  const idxs = await Promise.all(
    federal_state_urls.map((url) =>
      discover_federal_state(url).catch((err) => {
        throw err;
      })
    )
  ).catch((err) => {
    throw err;
  });

  const idx = await discover_wohngemeinschaft().catch((err) => {
    throw err;
  });

  const cities = Object.assign({}, idx, ...idxs);
  console.log(JSON.stringify(Object.values(cities), null, 2));
};

main();
