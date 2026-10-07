import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { routes as routesDynamic } from "@/routes/config";

function Title() {
  const location = useLocation();
  const [title, setTitle] = useState("");

  useEffect(() => {
    const found = routesDynamic.find((r) => r.path === location.pathname);
    setTitle(found ? found.Title : "");
  }, [location]);
  return <a className="font-semibold mx-4">{title}</a>;
}

export default Title;
