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
    const groups = match.groups || {};
    for (const key of Object.keys(groups)) {
      if (!key.startsWith("_") && groups[key] === undefined) {
        throw new Error(`Group '${key}' may not be undefined`);
      }
    }
    return groups;
  };
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

export { regex, assert_regex };
