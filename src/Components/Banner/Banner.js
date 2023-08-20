import React from "react";
import { useSelector } from "react-redux";

import styles from "./Banner.module.scss";

function Banner() {
  const bannerDetails = useSelector((state) => state.root.banner);

  return (
    <div
      className={`${styles.banner} ${
        bannerDetails.green
          ? styles.greenBanner
          : bannerDetails.red
          ? styles.redBanner
          : ""
      } ${bannerDetails.blinking ? styles.blink : ""}`}
    >
      <p className={styles.title}>{bannerDetails.text}</p>
    </div>
  );
}

export default Banner;
