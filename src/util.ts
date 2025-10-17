
export interface IStringLike {
  toString: () => string;
}

type domChild = Node | IStringLike;

export function buildDomTree<T extends Node>(parent: T, children: Array<domChild | domChild[]>): T {
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (child instanceof Array) {
      const innerParent = children[i - 1];
      if (innerParent instanceof Node) {
        buildDomTree(innerParent, child);
      } else {
        console.warn("buildDomTree: Invalid argument format. Array must follow a Node");
      }
    } else {
      if (child instanceof Node) {
        // Prevent HierarchyRequestError: do not append a node into one of its ancestors
        if (child.contains(parent)) {
          console.error('buildDomTree: Refusing to append a node into one of its ancestors. Skipping.');
          continue;
        }
        parent.appendChild(child);
      } else {
        parent.appendChild(document.createTextNode(child.toString()));
      }
    }
  }

  return parent;
}
