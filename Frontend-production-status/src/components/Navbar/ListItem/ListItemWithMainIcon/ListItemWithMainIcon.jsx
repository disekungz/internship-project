import React, { useEffect, useState } from "react";
import { Link, useLocation, matchPath } from "react-router-dom";

function ListItemWithMainIcon({ iconPaths, title, links, closeDrawer }) {
  const location = useLocation();
  const [currentPath, setCurrentPath] = useState(location.pathname);

  useEffect(() => {
    setCurrentPath(location.pathname);
  }, [location.pathname]);

  return (
    <li className="">
      <details>
        <summary className="group">
          <span>
            <img src={iconPaths} alt="icon" width={"24px"} height={"24px"} />
          </span>
          {title}
        </summary>
        <ul>
          {links.map((link, index) => {
            // Ensure link.path and currentPath are strings
            const pathToMatch = typeof link.path === "string" ? link.path : "";
            const isActive = matchPath(
              { path: pathToMatch, end: true },
              currentPath
            );

            return (
              <li key={index}>
                <Link
                  to={link.path}
                  onClick={closeDrawer}
                  className={
                    isActive
                      ? "bg-primary text-primary-content hover:bg-base-content hover:text-base-100"
                      : ""
                  }
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </details>
    </li>
  );
}

export default ListItemWithMainIcon;
