import React from "react";
import { useNavigate } from "react-router-dom";

import styles from "./Navbar.module.scss";

function Navbar() {
  const navigate = useNavigate();

  return (
    <div className={styles.container}>
      <div className={styles.logo}>
        <p className={styles.text} onClick={() => navigate("/")}>
          Trade assistant
        </p>
      </div>

      <div className={styles.right}>
        {/* <div className={styles.logout} onClick={() => handleLogout()}>
          <LogOut />
        </div> */}
      </div>
    </div>
  );
}

export default Navbar;
