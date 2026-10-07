import Buttonmode from "../ThemeSwitcher";
import Drawer from "./Drawer";
import Title from "./Title";
import { LogOut, Mail, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
function Navbar() {
  const userData = JSON.parse(localStorage.getItem("user")) || {};
  const navigate = useNavigate();

  return (
    <>
      <div className="sticky navbar bg-base-300 text-base-content border-none z-50">
        <div className="navbar-start">
          <Drawer />
        </div>
        <div className="navbar-center">
          <Title />
        </div>
        <div className="navbar-end space-x-2">
          <Buttonmode />
        </div>
      </div>
    </>
  );
}

export default Navbar;
