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
}

const find_h3_section = (selector: Selector, sectionName: string): Selector => {
  const h3 = selector
    .$("h3:not(.truncate_title)")
    .filter((e) => e.textContent?.trim() === sectionName);
  if (!h3.existsOnce()) {
    throw new Error(
      `Malformed document: Section ${sectionName} does not exist exactly once`
    );
  }
  const section = h3.elements()[0].parentElement;
  if (!section) {
    throw new Error("Malformed document: h3 tag has no parent element");
  }

  return Selector.from(section.outerHTML);
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

    // console.log(contact.$(".col-md-8").textContent());

    const headline = sel.$("#sliderTopTitle");
    // TODO enforce single element
    const [title] = headline.textContent().map((s) => s.trim());
    const flatmate_genders = headline.$("img").attribute("alt");
    // TODO enforce single element
    const [title_image] = sel
      .$('meta[property="og:image"]')
      .attribute("content");

    // TODO enforce single element
    const [room_size_description] = find_h3_section(sel, "Zimmergröße")
      .$("h2")
      .textContent()
      .map((s) => s.trim());
    const room_size = parseInt(
      assert_regex(room_size_description, /^([1-9][0-9]*)m²$/, 1)
    );

    // TODO enforce single element
    const [rent_description] = find_h3_section(sel, "Gesamtmiete")
      .$("h2")
      .textContent()
      .map((s) => s.trim());
    const rent = parseInt(
      assert_regex(rent_description, /^([1-9][0-9]*)€$/, 1)
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

    // Sections
    console.log(
      "Found sections:",
      sel.$("h3:not(.truncate_title)").map((e) => e.textContent?.trim())
    );

    return {
      url,
      contact: { name_image, profile_image, phone_number, online_tour },
      title,
      flatmate_genders,
      title_image,
      description,
      room_size,
      rent,
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
