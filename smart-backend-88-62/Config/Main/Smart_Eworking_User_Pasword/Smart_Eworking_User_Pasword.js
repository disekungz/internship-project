const express = require("express");
const app = express();

//*------------Smart-Eworking-User-Pasword----------------------//
// const smart_man_master_hr_Smart_Eworking_User_Pasword_Registor_E_Working = require("../../../routes/10.17.66.121/iot/smart/Smart-Eworking-User-Pasword/Registor-E-Working/smart_man_master_hr_msh");
// const eworking_user_password_Smart_Eworking_User_Pasword_Registor_E_Working = require("../../../routes/10.17.66.122/iot/smart_ewk/Smart-Eworking-User-Pasword/Registor-E-Working/smart_ewk_worker_user_pw");
// const smart_e_working_user_password_smart_man_lock_process = require("../../../routes/10.17.66.121/iot/smart/Smart-Eworking-User-Pasword/Man_lock_process/smart_man_lock_process");
const smart_e_working_user_password_smart_man_tc_certificate = require("../../../routes/10.17.100.193/smart/manpower/Smart-Eworking-User-Pasword/Man_certificate/smart_man_tc_certificate");
const smart_eworking_user_password_smart_certify_check = require("../../../routes/10.17.100.193/smart/manpower/Smart-Eworking-User-Pasword/Man_certificate/smart-certify-check");
//*------------Smart-Eworking-User-Pasword----------------------//

//*------------Smart-Eworking-User-Pasword----------------------//
// app.use(
//   "/smart_man_master_hr/Smart_Eworking_User_Pasword/Registor_E_Working",
//   smart_man_master_hr_Smart_Eworking_User_Pasword_Registor_E_Working
// );
// app.use(
//   "/eworking_user_password/Smart_Eworking_User_Pasword/Registor_E_Working",
//   eworking_user_password_Smart_Eworking_User_Pasword_Registor_E_Working
// );

// app.use(
//   "/smart_e_working_user_password/Man_lock_process/smart_man_lock_process",
//   smart_e_working_user_password_smart_man_lock_process
// );

app.use(
  "/smart_e_working_user_password/Man_certificate/smart_man_tc_certificate",
  smart_e_working_user_password_smart_man_tc_certificate
);
app.use(
  "/smart-eworking-user-password/smart-certify-check",
  smart_eworking_user_password_smart_certify_check,
);
//*------------Smart-Eworking-User-Pasword----------------------//

module.exports = app;
