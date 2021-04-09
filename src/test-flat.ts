import { parse_flat } from "./flat";

const main = async () => {
  const [_, __, url] = process.argv;
  if (!url) {
    throw new Error("URL required");
  }

  const flat = await parse_flat(url);
  console.log(flat);
};

main();
