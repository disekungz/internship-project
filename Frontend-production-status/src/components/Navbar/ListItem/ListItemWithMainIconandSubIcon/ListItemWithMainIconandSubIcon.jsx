import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

function ListItemWithMainIconandSubIcon({
  iconPaths,
  title,
  links,
  closeDrawer,
}) {
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
          {links.map((link, index) => (
            <li key={index}>
              <Link
                to={link.path}
                onClick={closeDrawer}
                className={
                  currentPath === link.path
                    ? "bg-primary text-primary-content hover:bg-base-content hover:text-base-100"
                    : " "
                }
              >
                <span>
                  <img
                    src={link.icon}
                    alt="icon"
                    width={"24px"}
                    height={"24px"}
                  />
                </span>
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </details>
    </li>
  );
}

export default ListItemWithMainIconandSubIcon;
