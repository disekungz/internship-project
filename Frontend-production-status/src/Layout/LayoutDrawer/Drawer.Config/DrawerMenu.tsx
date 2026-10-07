import { TrendingUp, Factory, UsersRound } from "lucide-react";
import DrawerMenuGroup from "../Components/DrawerMenuGroup";

import {
  routes,
  routes_wip,
  routes_man,
  routes_productivity,
} from "@/routes/config";

import dashboard_app from "@/assets/icon/menuDrawer/dashboard/dashboard.png";
import productivity_icon from "@/assets/icon/menuDrawer/general/work-efficiency.png";

interface DrawerMenuProps {
  isOpen: boolean;
  toggleDrawer: () => void;
}

const DrawerMenu = ({ isOpen, toggleDrawer }: DrawerMenuProps) => {
  return (
    <nav className="flex-1 flex flex-col gap-2 p-2 overflow-y-auto">
      <DrawerMenuGroup
        isOpen={isOpen}
        toggleDrawer={toggleDrawer}
        title="Dashboard"
        icon={dashboard_app}
        links={[
          {
            label: "OUTPUT",
            icon: TrendingUp,
            subLinks: routes
          },
          {
            label: "WIP",
            icon: Factory,
            subLinks: routes_wip
          }
        ]}
      />

      <DrawerMenuGroup
        isOpen={isOpen}
        toggleDrawer={toggleDrawer}
        title="Productivity"
        icon={productivity_icon}
        links={[
          ...routes_productivity,
          {
            label: "MANPOWER",
            icon: UsersRound,
            subLinks: routes_man,
          },
        ]}
      />

    </nav>
  );
};

export default DrawerMenu;
