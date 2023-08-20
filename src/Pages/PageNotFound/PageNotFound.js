import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import notFoundImage from "assets/images/not-found.png";

import styles from "./PageNotFound.module.scss";

let interval;
function PageNotFound() {
  const navigate = useNavigate();

  const [seconds, setSeconds] = useState(0);

  const startTimer = () => {
    interval = setInterval(() => {
      setSeconds((prev) => {
        if (prev === 0) {
          clearInterval(interval);
          navigate("/");
          return 0;
        }

        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    if (window.location.pathname === "/") return;

    setSeconds(15);
    startTimer();

    return () => clearInterval(interval);
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.head}>
        {/* <img
          src="/logos/permarLogo.svg"
          alt="Company name"
        /> */}
        <p className={styles.title}>Sleeping OWL - Music</p>
      </div>

      <div className={styles.image}>
        <img src={notFoundImage} alt="Page not found" />
      </div>

      <p className={styles.heading}>Page not found!</p>
      <p className={styles.desc}>
        Wait here boss! You have reached the borders. Fallback to the known
        territory
      </p>

      {window.location.pathname === "/" ? (
        ""
      ) : (
        <>
          <p className={styles.timer}>
            Redirecting in <span>{seconds} </span> seconds
          </p>

          <button className="button" onClick={() => navigate("/")}>
            Go to HOME
          </button>
        </>
      )}
    </div>
  );
}

export default PageNotFound;
