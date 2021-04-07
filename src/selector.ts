import { JSDOM } from "jsdom";

const concat = <A>(as: A[][]): A[] => {
  return ([] as A[]).concat(...as);
};

const select = (element: Element, selector: string): Element[] => {
  return Array.from(element.querySelectorAll(selector));
};

const unsafeGetAttribute = (element: Element, attribute: string): string => {
  if (element.hasAttribute(attribute)) {
    return element.getAttribute(attribute)!;
  } else {
    throw new Error(`Element has no attribute '${attribute}'`);
  }
};

const unsafeGetTextContent = (element: Element): string => {
  if (element.textContent === null) {
    throw new Error("Element has no text content");
  } else {
    return element.textContent;
  }
};

const getJSON = (element: Element): any => {
  const object: any = {};
  for (const attribute of element.getAttributeNames()) {
    object[attribute] = element.getAttribute(attribute);
  }
  object["tagName"] = element.tagName;
  object["innerHTML"] = element.innerHTML;
  object["outerHTML"] = element.outerHTML;
  object["textContent"] = unsafeGetTextContent(element);

  if (element.hasAttribute("class")) {
    object["class"] = Array.from(element.classList);
  }

  return object;
};

class Selector {
  private readonly selection: Element[];

  public constructor(selection: Element[]) {
    this.selection = selection;
  }

  public static from(html: string): Selector {
    // TODO handle url
    const dom = new JSDOM(html);
    const rootElement = dom.window.document.querySelector("*");
    if (!rootElement) {
      throw new Error("Document has no root element");
    }

    return new Selector([rootElement]);
  }

  public $(selector: string): Selector {
    return new Selector(concat(this.selection.map((e) => select(e, selector))));
  }

  public $$(selector: string): Selector[] {
    return this.$(selector).map((e) => new Selector([e]));
  }

  public attribute(attribute: string): string[] {
    return this.map((e) => unsafeGetAttribute(e, attribute));
  }

  public textContent(): string[] {
    return this.map((e) => unsafeGetTextContent(e));
  }

  public innerHTML(): string[] {
    return this.map((e) => e.innerHTML);
  }

  public outerHTML(): string[] {
    return this.map((e) => e.outerHTML);
  }

  public json(): object[] {
    return this.map((e) => getJSON(e));
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
    if (this.selection.length !== 1) {
      throw new Error("Selection does not have exactly one element");
    }
    const [e] = this.selection;
    return new SingleSelector(e);
  }

  public map<A>(f: (_: Element) => A): A[] {
    return this.selection.map(f);
  }

  public filter(p: (_: Element) => boolean): Selector {
    return new Selector(this.selection.filter(p));
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

  public constructor(selection: Element) {
    this.selection = selection;
  }

  public $(selector: string): Selector {
    return new Selector(select(this.selection, selector));
  }

  public $$(selector: string): SingleSelector[] {
    return this.$(selector).map((e) => new SingleSelector(e));
  }

  public attribute(attribute: string): string {
    return unsafeGetAttribute(this.selection, attribute);
  }

  public textContent(): string {
    return unsafeGetTextContent(this.selection);
  }

  public innerHTML(): string {
    return this.selection.innerHTML;
  }

  public outerHTML(): string {
    return this.selection.outerHTML;
  }

  public json(): object {
    return getJSON(this.selection);
  }

  public element(): Element {
    return this.selection;
  }

  public map<A>(f: (_: Element) => A): A {
    return f(this.selection);
  }

  public filter(p: (_: Element) => boolean): Selector {
    return new Selector([this.selection].filter(p));
  }

  public forEach(action: (_: Element) => void): SingleSelector {
    action(this.selection);
    return this;
  }
}

export { Selector, SingleSelector };

// TODO selection history for more detailed error messages
