import { JSDOM } from "jsdom";
import { concat } from "./util";

const select = (element: Element, selector: string): Element[] => {
  return Array.from(element.querySelectorAll(selector));
};

const unsafeGetAttribute = (
  element: Element,
  attribute: string,
  selection_history: string[]
): string => {
  if (element.hasAttribute(attribute)) {
    return element.getAttribute(attribute)!;
  } else {
    throw error(`Element has no attribute '${attribute}'`, selection_history);
  }
};

const unsafeGetTextContent = (
  element: Element,
  selection_history: string[]
): string => {
  if (element.textContent === null) {
    throw error("Element has no text content", selection_history);
  } else {
    return element.textContent;
  }
};

const getJSON = (element: Element, selection_history: string[]): any => {
  const object: any = {};
  for (const attribute of element.getAttributeNames()) {
    object[attribute] = element.getAttribute(attribute);
  }
  object["tagName"] = element.tagName;
  object["innerHTML"] = element.innerHTML;
  object["outerHTML"] = element.outerHTML;
  object["textContent"] = unsafeGetTextContent(element, selection_history);

  if (element.hasAttribute("class")) {
    object["class"] = Array.from(element.classList);
  }

  return object;
};

const error = (message: string, selection_history: string[]) => {
  return new Error(`Selection [${selection_history.join(" | ")}]: ${message}`);
};

class Selector {
  private readonly selection: Element[];
  private readonly selection_history: string[];

  public constructor(selection: Element[], selection_history: string[]) {
    this.selection = selection;
    this.selection_history = selection_history;
  }

  public static from(html: string): Selector {
    // TODO handle url
    const dom = new JSDOM(html);
    const rootElement = dom.window.document.querySelector("*");
    if (!rootElement) {
      throw new Error("Document has no root element");
    }

    return new Selector([rootElement], []);
  }

  public $(selector: string): Selector {
    return new Selector(
      concat(this.selection.map((e) => select(e, selector))),
      this.selection_history.concat([selector])
    );
  }

  public $$(selector: string): SingleSelector[] {
    return this.$(selector).map(
      (e) => new SingleSelector(e, this.selection_history.concat([selector]))
    );
  }

  public attribute(attribute: string): string[] {
    return this.map((e) =>
      unsafeGetAttribute(e, attribute, this.selection_history)
    );
  }

  public textContent(): string[] {
    return this.map((e) => unsafeGetTextContent(e, this.selection_history));
  }

  public innerHTML(): string[] {
    return this.map((e) => e.innerHTML);
  }

  public outerHTML(): string[] {
    return this.map((e) => e.outerHTML);
  }

  public json(): object[] {
    return this.map((e) => getJSON(e, this.selection_history));
  }

  public elements(): Element[] {
    return this.map((e) => e);
  }

  public exists(): boolean {
    return this.selection.length !== 0;
  }

  public existsOnce(): boolean {
    return this.selection.length === 1;
  }

  public single(): SingleSelector {
    if (this.selection.length === 0) {
      throw error("No such element exists", this.selection_history);
    }
    if (this.selection.length > 1) {
      throw error("Has more than one element", this.selection_history);
    }
    const [e] = this.selection;
    return new SingleSelector(e, this.selection_history);
  }

  public map<A>(f: (_: Element) => A): A[] {
    return this.selection.map(f);
  }

  public filter(p: (_: Element) => boolean): Selector {
    return new Selector(
      this.selection.filter(p),
      this.selection_history.concat(["call to filter()"])
    );
  }

  public forEach(action: (_: Element) => void): Selector {
    this.selection.forEach(action);
    return this;
  }
}

// Like Selector, but is ensured to carry only one element
// All A[] return values from Selector therefore are A for SingleSelector
class SingleSelector {
  private readonly selection: Element;
  private readonly selection_history: string[];

  public constructor(selection: Element, selection_history: string[]) {
    this.selection = selection;
    this.selection_history = selection_history;
  }

  public $(selector: string): Selector {
    return new Selector(
      select(this.selection, selector),
      this.selection_history.concat([selector])
    );
  }

  public $$(selector: string): SingleSelector[] {
    return this.$(selector).map(
      (e) => new SingleSelector(e, this.selection_history.concat([selector]))
    );
  }

  public attribute(attribute: string): string {
    return unsafeGetAttribute(
      this.selection,
      attribute,
      this.selection_history
    );
  }

  public textContent(): string {
    return unsafeGetTextContent(this.selection, this.selection_history);
  }

  public innerHTML(): string {
    return this.selection.innerHTML;
  }

  public outerHTML(): string {
    return this.selection.outerHTML;
  }

  public json(): object {
    return getJSON(this.selection, this.selection_history);
  }

  public element(): Element {
    return this.selection;
  }

  public map<A>(f: (_: Element) => A): A {
    return f(this.selection);
  }

  public filter(p: (_: Element) => boolean): Selector {
    return new Selector(
      [this.selection].filter(p),
      this.selection_history.concat(["call to filter()"])
    );
  }

  public forEach(action: (_: Element) => void): SingleSelector {
    action(this.selection);
    return this;
  }
}

export { Selector, SingleSelector };

// TODO selection history for more detailed error messages
