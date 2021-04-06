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

// Joins given regular expressions with /\s*/
// Encloses the resulting regex in /^/ and /$/
// Returns a closure that, matches its argument against the resulting regex
// and returns the named groups.
// All groups with a name that does not start with '_' are enforced to be defined.
const regex = (...expressions: RegExp[]) => {
  const regex = new RegExp(
    [/^/, ...expressions, /$/].map((r) => r.source).join(/\s*/.source)
  );

  return (string: string) => {
    const match = string.match(regex);
    if (!match) {
      throw new Error(`String '${string}' did not match ${regex}`);
    }
    const groups = match.groups;
    if (!groups) {
      throw new Error("Match object has no member 'groups'");
    }
    for (const key of Object.keys(groups)) {
      console.log(key);
      if (!key.startsWith("_") && groups[key] === undefined) {
        throw new Error(`Group '${key}' may not be undefined`);
      }
    }
    return groups;
  };
};

interface Flat {
  url: string;
  contact: {
    name_image: string;
    profile_image?: string;
    phone_number: boolean;
    online_tour: boolean;
  };
  title?: string;
  flatmate_genders?: string[];
  title_image?: string;
  description?: { title: string; text: string }[];
  room_size?: number;
  rent: number;
  rent_details?: {
    rent: number;
    utility: number | "n.a.";
    additional_costs: number | "n.a.";
    deposit?: number;
    ransom?: number;
  };
  address: string;
  availability: {
    from: string;
    to?: string;
    online: string;
  };
  flatshare_details: {
    details: string[];
    looking_for: string;
  };
  property_details: string[];
}

const find_h3_section = (
  selector: Selector,
  sectionName: string,
  climb: number = 1
): Selector => {
  const h3 = selector
    .$("h3:not(.truncate_title)")
    .filter((e) => e.textContent?.trim() === sectionName);
  if (!h3.existsOnce()) {
    throw new Error(
      `Malformed document: Section ${sectionName} does not exist exactly once`
    );
  }
  let section = h3.elements()[0];
  if (climb === 0) {
    return Selector.from(section.outerHTML);
  }

  let ancestor = section.parentElement;
  if (!ancestor) {
    throw new Error("Malformed document: h3 tag has no parent element");
  }
  for (let i = 1; i < climb; i++) {
    ancestor = ancestor.parentElement;
    if (!ancestor) {
      throw new Error("Malformed document: h3 tag has no parent element");
    }
  }
  return Selector.from(ancestor.outerHTML);
};

const assert_regex = (
  string: string,
  regex: RegExp,
  group: number = 0
): string => {
  const match = string.match(regex);
  if (!match) {
    throw new Error(`String ${string} does not match ${regex}`);
  }
  if (match[group] === undefined) {
    throw new Error(`No match group ${group}`);
  }

  return match[group];
};

// parse a string of the form "123€" to the numeric value 123 or fail
const parse_cost = (cost: string): number => {
  return parseInt(assert_regex(cost, /^([0-9]*)€$/, 1), 10);
};

// like parse_cost but allows for null costs marked with the value "n.a."
const parse_cost_na = (cost: string): number | "n.a." => {
  if (cost === "n.a.") {
    return "n.a.";
  } else {
    return parse_cost(cost);
  }
};

const parse_rent_details = (div: Selector) => {
  const text = div.$("td:not(.noprint)").textContent().join("\n");
  const { rent, utility, additional_costs, _deposit, _ransom } = regex(
    /Miete:\s*(?<rent>[0-9]+€)/,
    /Nebenkosten:\s*\D*\s*(?<utility>[0-9]+€|n\.a\.)/,
    /Sonstige Kosten:\s*(?<additional_costs>[0-9]+€|n\.a\.)/,
    /(Kaution:\s*(?<_deposit>[0-9]+€))?/,
    /(Ablösevereinbarung:\s*(?<_ransom>[0-9]+€|n\\.a\\.))?/
  )(text);

  return {
    rent: parse_cost(rent),
    utility: parse_cost_na(utility),
    additional_costs: parse_cost_na(additional_costs),
    deposit: _deposit === undefined ? undefined : parse_cost(_deposit),
    ransom: _ransom === undefined ? undefined : parse_cost(_ransom),
  };
};

const parse_availability = (div: Selector) => {
  const av = div.$("div > p, div > b").textContent().join("\n");

  const regex = /\s*frei ab:\s*([0-9\.]+)\s+(frei bis:\s*([0-9\.]+))?\s+Online:\s*(\d+ (Sekunden?|Minuten?|Stunden?|Tage?)|([0-9\.]+))\s*/;
  const match = av.match(regex);
  if (!match) {
    throw new Error(`String ${av} does not match ${regex}`);
  }

  if (!match[1] || !match[4]) {
    throw new Error(`Malformed availability section ${av}`);
  }

  return {
    from: match[1],
    to: match[3],
    online: match[4],
  };
};

const parse_flatshare_details = (div: Selector) => {
  const details = div.$$("h4, ul");
  if (
    details.length !== 4 ||
    details[0].textContent().join("\n").trim() !== "Die WG" ||
    details[2].textContent().join("\n").trim() !== "Gesucht wird"
  ) {
    throw new Error("Malformed document");
  }

  // TODO enforce single element
  const [looking_for] = details[3]
    .$("li")
    .textContent()
    .map((s) => s.trim())
    .map((s) => s.replace(/\s+/g, " "));

  console.log();

  return {
    details: details[1]
      .$("li")
      .textContent()
      .map((s) => s.trim())
      .map((s) => s.replace(/\s+/g, " "))
      .filter((s) => s !== ""),
    looking_for,
  };
};

// TODO cover property details in-depth (i.e. more than a list of tags)
const parse_property_details = (details: Selector): string[] => {
  const tags: string[] = [];

  // TODO enforce single element
  details.$$(".row > div:not(.noprint)").forEach((detail) => {
    // e.g. <span class="glyphicons glyphicons-building noprint">
    // TODO enforce single element
    const [icon] = detail
      .$("span")
      .attribute("class")
      .map((s) => s.replace(/^glyphicons | noprint$/g, ""));

    // TODO enforce single element
    const [description] = detail
      .textContent()
      .map((s) => s.trim().replace(/\s+/g, " "));

    tags.push(description);
  });

  return tags;
};

const parse_flat = async (url: string): Promise<Flat> => {
  return await selectorFromURL(url, (sel) => {
    const contact = sel.$("div.rhs_contact_information > div.panel-body");
    // TODO enforce single element
    let profile_image: string | undefined = undefined;
    const [style] = contact
      .$("div.profile_image_dav.cursor-pointer")
      .attribute("style");
    if (style) {
      profile_image = style.match(/background-image: url\('(.*)'\)/)?.[1];
    }

    // TODO enforce single element
    const [name_image] = contact.$("img").attribute("src");

    const phone_number = contact.$("#left_column_show_phone_numbers").exists();
    const online_tour = contact.$(".online_tour_badge").exists();

    const headline = sel.$("#sliderTopTitle");
    // TODO enforce single element
    const [title] = headline.textContent().map((s) => s.trim());
    const flatmate_genders = headline.$("img").attribute("alt");
    // TODO enforce single element
    let [title_image]: (string | undefined)[] = sel
      .$('meta[property="og:image"]')
      .attribute("content");
    if (title_image === "https://img.wg-gesucht.de/") {
      title_image = undefined;
    }

    // TODO enforce single element
    const [room_size_description] = find_h3_section(sel, "Zimmergröße")
      .$("h2")
      .textContent()
      .map((s) => s.trim());
    const room_size = parseInt(
      assert_regex(room_size_description, /^([1-9][0-9]*)m²$/, 1),
      10
    );

    // TODO enforce single element
    const [rent_description] = find_h3_section(sel, "Gesamtmiete")
      .$("h2")
      .textContent()
      .map((s) => s.trim());
    const rent = parse_cost(rent_description);

    // TODO enforce single element
    const rent_details = parse_rent_details(find_h3_section(sel, "Kosten"));

    // TODO enforce single element
    const [address] = find_h3_section(sel, "Adresse")
      .$("a")
      .textContent()
      .map((s) => s.trim())
      .map((s) => s.replace(/\s+/g, " "));

    // TODO enforce single element
    const availability = parse_availability(
      find_h3_section(sel, "Verfügbarkeit")
    );

    // TODO enforce single element
    const flatshare_details = parse_flatshare_details(
      find_h3_section(sel, "WG-Details", 2)
    );

    // TODO enforce single element
    const property_details = parse_property_details(
      find_h3_section(sel, "Angaben zum Objekt")
    );

    const description = sel
      .$$("#ad_description_text div[id^=freitext_]")
      .map((chapter) => {
        // TODO enforce single element
        const [title] = chapter
          .$("h3")
          .textContent()
          .map((s) => s.trim());
        // TODO enforce single element
        const [text] = chapter
          .$("p")
          .textContent()
          .map((s) => s.trim());

        return { title, text };
      });

    // Perform a check of all sections in the document against covered_or_ignored_sections
    // This is an approach at offensive programming and is meant to assist in understanding
    // the schmema of wg-gesucht in the future
    const covered_or_ignored_sections = [
      "Zimmergröße",
      "Gesamtmiete",
      "Kosten",
      "Adresse",
      "Verfügbarkeit",
      "WG-Details",
      "Angaben zum Objekt",
      "Karte", // ignored
      "Kontakt", // ignored
      "", // ignored - this occurs for ads without photos
    ];
    const sections = sel
      .$(":not([id^=freitext_]) > h3:not(.truncate_title)")
      .textContent()
      .map((s) => s.trim())
      .forEach((section) => {
        if (!covered_or_ignored_sections.includes(section)) {
          throw new Error(`Encountered unknown section '${section}'`);
        }
      });

    return {
      url,
      contact: { name_image, profile_image, phone_number, online_tour },
      title,
      flatmate_genders,
      title_image,
      description,
      room_size,
      rent,
      rent_details,
      address,
      availability,
      flatshare_details,
      property_details,
    };
  });
};

const main = async () => {
  const [_, __, url] = process.argv;
  if (!url) {
    throw new Error("URL required");
  }

  const flat = await parse_flat(url);
  console.log(flat);
};

main();
