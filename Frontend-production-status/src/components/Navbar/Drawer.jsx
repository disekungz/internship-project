import React, { useState } from "react";
import ListButton from "./ListButton";
import { AlignJustify } from "lucide-react";
function Drawer() {
  const [isOpen, setIsOpen] = useState(false);

  const closeDrawer = () => setIsOpen(false);
  const toggleDrawer = () => setIsOpen(!isOpen);

  return (
    <>
      <div className="drawer z-10 ">
        <input
          id="my-drawer"
          type="checkbox"
          className="drawer-toggle "
          checked={isOpen}
          onChange={toggleDrawer}
        />
        <div className="drawer-content">
          <label htmlFor="my-drawer" className="btn btn-ghost">
            <AlignJustify />
          </label>
        </div>
        <div className="drawer-side">
          <label
            htmlFor="my-drawer"
            aria-label="close sidebar"
            className="drawer-overlay"
          ></label>
          <ListButton closeDrawer={closeDrawer} />
        </div>
      </div>
    </>
  );
}

export default Drawer;
