import React from "react";
import { Outlet } from "react-router-dom";
import { useSelector } from "react-redux";

import Navbar from "Components/Navbar/Navbar";
import Footer from "Components/Footer/Footer";
import Banner from "Components/Banner/Banner";

import styles from "./AppLayout.module.scss";

function AppLayout() {
  const bannerDetails = useSelector((state) => state.root.banner);

  return (
    <div className={styles.container}>
      <Navbar />
      {bannerDetails.text && <Banner />}

      <div className={styles.inner}>
        <Outlet />

        <Footer />
      </div>
    </div>
  );
}

export default AppLayout;
