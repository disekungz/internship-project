import React from "react";
import { X } from "lucide-react";
function TitleDrawer({ closeDrawer }) {
  return (
    <>
      <div className="flex items-center justify-between p-4 gap-1">
        <div className="bg-base-100 flex gap-2">
          <p className="text-xl font-extrabold text-center m-auto text-nowrap">
            FETL-A1
          </p>
        </div>
        <button
          type="button"
          data-view-component="true"
          className="btn  btn-sm text-base-content"
          onClick={closeDrawer}
        >
          <X />
        </button>
      </div>
    </>
  );
}

export default TitleDrawer;
