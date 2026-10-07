import React from "react";
import ListiTem_2 from "./ListiTem_2";

const exampleIconPaths = [
  { img: "/Icon/Common/icons8-dashboard-96.png" }, // Main section icon
];

const exampleTitle = "Web APP";

const exampleLinks = [
  {
    path: "/smart-web-app/",
    label: "WEB-APP",
    icon: "/Icon/Common/icons8-web-app-96.png", // Icon for WEB-APP
  },
  {
    path: "/smart-web-app/test_camera",
    label: "TEST_CAMERA",
    icon: "/Icon/Common/icons8-test-camera-96.png", // Icon for TEST_CAMERA
  },
];

function App() {
  const closeDrawer = () => {
    console.log("Drawer closed");
  };

  return (
    <ul>
      <ListiTem_2
        iconPaths={exampleIconPaths}
        title={exampleTitle}
        links={exampleLinks}
        closeDrawer={closeDrawer}
      />
    </ul>
  );
}

export default App;
