import React from "react";
import { ArrowRight } from "react-feather";

import Spinner from "Components/Spinner/Spinner";

import styles from "./Button.module.scss";

const Button = ({
  className,
  children,
  onClick,
  disabled = false,
  outlineButton,
  redButton,
  cancelButton,
  withArrow,
  useSpinnerWhenDisabled = false,
  whiteSpinner = false,
  ...inputProps
}) => {
  return (
    <button
      type={inputProps.type || "button"}
      onClick={(event) => (onClick ? onClick(event) : "")}
      disabled={disabled ? true : false}
      className={`${styles.button} ${
        outlineButton ? styles["button-outline"] : ""
      } ${disabled ? styles["button-disabled"] : ""} ${className || ""} ${
        disabled && outlineButton ? styles["outline-button-disabled"] : ""
      }
        ${redButton ? styles.buttonDelete : ""} 
        ${cancelButton ? styles["button-cancel"] : ""}`}
      {...inputProps}
    >
      {children}
      {useSpinnerWhenDisabled && disabled ? (
        <Spinner small white={redButton} />
      ) : withArrow ? (
        <ArrowRight className={styles.icon} />
      ) : (
        ""
      )}
    </button>
  );
};

export default Button;
