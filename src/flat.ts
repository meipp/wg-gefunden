import { assert_regex, regex } from "./regex";
import { Selector, SingleSelector } from "./selector";
import { selectorFromURL } from "./util";

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
  description?: { title?: string; text: string }[];
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
): SingleSelector => {
  const h3 = selector
    .$("h3:not(.truncate_title)")
    .filter((e) => e.textContent?.trim() === sectionName)
    .single();
  let section = h3.element();
  if (climb === 0) {
    return Selector.from(section.outerHTML).single();
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
  return Selector.from(ancestor.outerHTML).single();
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

const parse_rent_details = (div: SingleSelector) => {
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

const parse_availability = (div: SingleSelector) => {
  const av = div.$("div > p, div > b").textContent().join("\n");

  const { from, _to, online } = regex(
    /frei ab:\s*(?<from>[0-9\.]+)/,
    /(frei bis:\s*(?<_to>[0-9\.]+))?/,
    /Online:\s*(?<online>\d+ (Sekunden?|Minuten?|Stunden?|Tage?)|([0-9\.]+))/
  )(av);

  return {
    from,
    to: _to,
    online,
  };
};

const parse_flatshare_details = (div: SingleSelector) => {
  const details = div.$$("h4, ul");
  if (
    details.length !== 4 ||
    details[0].textContent().trim() !== "Die WG" ||
    details[2].textContent().trim() !== "Gesucht wird"
  ) {
    throw new Error("Malformed document");
  }

  const looking_for = details[3]
    .$("li")
    .single()
    .textContent()
    .trim()
    .replace(/\s+/g, " ");

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
const parse_property_details = (details: SingleSelector): string[] => {
  const tags: string[] = [];

  details.$$(".row > div:not(.noprint)").forEach((detail) => {
    // e.g. <span class="glyphicons glyphicons-building noprint">
    const icon = detail
      .$("span:not(.glyphicon-info-sign)")
      .single()
      .attribute("class")
      .replace(/^glyphicons | noprint$/g, "");

    const description = detail.textContent().trim().replace(/\s+/g, " ");

    tags.push(description);
  });

  return tags;
};

const parse_flat = async (url: string): Promise<Flat | "captcha"> => {
  return await selectorFromURL(url, (sel) => {
    const contact = sel.$("div.rhs_contact_information > div.panel-body");
    let profile_image: string | undefined = undefined;

    const image_div = contact
      .single()
      .$("div.profile_image_dav.cursor-pointer");
    if (image_div.exists()) {
      const style = image_div.single().attribute("style");
      profile_image = style.match(/background-image: url\('(.*)'\)/)?.[1];
    }

    const name_image = contact.$("img").single().attribute("src");

    const phone_number = contact.$("#left_column_show_phone_numbers").exists();
    const online_tour = contact.$(".online_tour_badge").exists();

    const headline = sel.$("#sliderTopTitle");
    const title = headline.single().textContent().trim();
    const flatmate_genders = headline.$("img").attribute("alt");
    let title_image: string | undefined = sel
      .$('meta[property="og:image"]')
      .single()
      .attribute("content");
    if (title_image === "https://img.wg-gesucht.de/") {
      title_image = undefined;
    }

    const room_size_description = find_h3_section(sel, "Zimmergröße")
      .$("h2")
      .single()
      .textContent()
      .trim();
    const room_size = parseInt(
      assert_regex(room_size_description, /^([1-9][0-9]*)m²$/, 1),
      10
    );

    const rent_description = find_h3_section(sel, "Gesamtmiete")
      .$("h2")
      .single()
      .textContent()
      .trim();
    const rent = parse_cost(rent_description);

    const rent_details = parse_rent_details(find_h3_section(sel, "Kosten"));

    const address = find_h3_section(sel, "Adresse")
      .$('a[href="#mapContainer"]')
      .single()
      .textContent()
      .trim()
      .replace(/\s+/g, " ");

    const availability = parse_availability(
      find_h3_section(sel, "Verfügbarkeit")
    );

    const flatshare_details = parse_flatshare_details(
      find_h3_section(sel, "WG-Details", 2)
    );

    const property_details = parse_property_details(
      find_h3_section(sel, "Angaben zum Objekt")
    );

    const description = sel
      .$$("#ad_description_text div[id^=freitext_]")
      .map((chapter) => {
        // TODO keep in mind that some ads don't have titles in their description
        let title: string | undefined = undefined;
        if (chapter.$("h3").exists()) {
          title = chapter.$("h3").single().textContent().trim();
        }

        const text = chapter.$("p").single().textContent().trim();

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

export { Flat, parse_flat };
