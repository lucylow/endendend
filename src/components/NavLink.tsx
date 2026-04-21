import { Link } from "@tanstack/react-router";
import { forwardRef, type ReactNode } from "react";

interface NavLinkCompatProps extends Omit<React.ComponentProps<typeof Link>, "activeProps"> {
  className?: string;
  activeClassName?: string;
  pendingClassName?: string;
  end?: boolean;
  children?: ReactNode;
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  ({ className, activeClassName, pendingClassName: _pendingClassName, end, children, ...props }, ref) => {
    return (
      <Link
        ref={ref}
        {...props}
        activeOptions={end ? { exact: true } : undefined}
        className={className}
        activeProps={{
          className: activeClassName,
        }}
      >
        {children}
      </Link>
    );
  },
);

NavLink.displayName = "NavLink";

export { NavLink };
