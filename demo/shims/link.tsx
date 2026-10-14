import type { AnchorHTMLAttributes } from "react";
import { navigate } from "./router";

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; prefetch?: boolean };

export default function Link({ href, prefetch: _prefetch, onClick, ...rest }: Props) {
  return (
    <a
      href={`#${href}`}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || rest.target) return;
        event.preventDefault();
        navigate(href);
      }}
      {...rest}
    />
  );
}
