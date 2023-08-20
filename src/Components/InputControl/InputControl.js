import React, { forwardRef, useState } from "react";
import { Eye, EyeOff } from "react-feather";

import { handleNumericInputKeyDown } from "utils/util";

import styles from "./InputControl.module.scss";

const InputControl = forwardRef(
  (
    {
      subLabel,
      label,
      error,
      textInsideInput,
      className,
      inputClass,
      password = false,
      hintText = "",
      icon,
      numericInput = false,
      ...props
    },
    ref
  ) => {
    const [visible, setVisible] = useState(password ? false : true);

    return (
      <div className={styles.container}>
        {label && (
          <label className={styles.label}>
            {label}
            <span> {subLabel}</span>
          </label>
        )}
        <div
          className={`${styles.inputContainer} basic-input ${
            error ? "basic-input-error" : ""
          } ${className || ""}`}
        >
          {textInsideInput && <p className={styles.text}>{textInsideInput}</p>}
          <input
            className={`${inputClass || ""} ${
              password ? styles.passwordInput : ""
            } `}
            type={numericInput ? "number" : visible ? "text" : "password"}
            style={{ paddingLeft: textInsideInput ? "0px" : "" }}
            ref={ref}
            onKeyDown={(event) =>
              numericInput ? handleNumericInputKeyDown(event) : ""
            }
            onPaste={(event) => {
              const text = event.clipboardData.getData("text");
              if (isNaN(parseInt(text)) && numericInput) event.preventDefault();
            }}
            {...props}
          />

          {password ? (
            <div className={styles.eye} onClick={() => setVisible(!visible)}>
              {visible ? <Eye /> : <EyeOff />}
            </div>
          ) : icon ? (
            <div className={styles.icon}>{icon}</div>
          ) : (
            ""
          )}
        </div>
        {hintText ? <p className={styles.hint}>{hintText}</p> : ""}
        {error ? <p className={styles.errorMsg}>{error}</p> : ""}
      </div>
    );
  }
);

export default InputControl;
