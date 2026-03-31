import * as React from "react";

export function resolveRenderProps(
  render: React.ReactElement | ((props: any, state: any) => React.ReactElement) | undefined,
  asChild: boolean | undefined,
  children: React.ReactNode,
) {
  const childElement = asChild && React.isValidElement(children) ? children : undefined;

  return {
    renderElement: render ?? childElement,
    children: childElement && render === undefined ? undefined : children,
  };
}

export function composeRefs<T>(...refs: Array<React.Ref<T> | undefined>) {
  return (node: T | null) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === "function") {
        ref(node);
      } else {
        (ref as React.MutableRefObject<T | null>).current = node;
      }
    }
  };
}
