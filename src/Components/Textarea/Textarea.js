import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";

import { autoAdjustTextareaHeight } from "utils/util";

import styles from "./Textarea.module.scss";

const TextArea = React.forwardRef(
  (
    {
      containerClass,
      name,
      type,
      placeholder,
      label,
      subLabel,
      error,
      maxCount,
      className,
      onChange,
      icon,
      hintText,
      children,
      spacedOut = false,
      autoAdjustHeight = false,
      ...inputProps
    },
    ref
  ) => {
    const [value, setValue] = useState(inputProps.value || "");

    const handleChange = (event) => {
      setValue(event.target.value);
      if (!(maxCount && value.length == maxCount) && onChange) onChange(event);
    };

    useEffect(() => {
      if (inputProps.value) setValue(inputProps.value);
    }, [inputProps.value]);

    return (
      <div className={`${styles.container} ${containerClass || ""}`}>
        {label && (
          <label
            className={styles.label}
            style={{ marginBottom: spacedOut ? "8px" : "" }}
          >
            {label} {inputProps.required && "*"}
          </label>
        )}
        {subLabel ? (
          <label
            className={styles.subLabel}
            style={{ marginBottom: spacedOut ? "8px" : "" }}
          >
            {subLabel}
          </label>
        ) : (
          ""
        )}

        <div className={styles.inner}>
          <textarea
            ref={ref}
            id={name}
            type={type}
            placeholder={placeholder}
            onChange={handleChange}
            className={`basic-input ${styles.input} ${className || ""} ${
              error ? "basic-input-error" : ""
            }`}
            maxLength={maxCount}
            onInput={(e) =>
              autoAdjustHeight ? autoAdjustTextareaHeight(e) : ""
            }
            rows={autoAdjustHeight ? 1 : ""}
            onFocus={(e) =>
              autoAdjustHeight ? autoAdjustTextareaHeight(e) : ""
            }
            {...inputProps}
          />
          {children}

          {icon ? <div className={styles.icon}>{icon}</div> : ""}

          {maxCount ? (
            <p className={styles.count}>
              {value.length}/{maxCount}
            </p>
          ) : (
            ""
          )}
        </div>
        {error ? (
          <p className={`${styles.error} error-msg`}>{error}</p>
        ) : hintText ? (
          <p className={styles.hint}>{hintText}</p>
        ) : (
          ""
        )}
      </div>
    );
  }
);

TextArea.propTypes = {
  ref: PropTypes.any,
  icon: PropTypes.any,
  children: PropTypes.element,
  containerClass: PropTypes.string,
  name: PropTypes.string,
  type: PropTypes.string,
  placeholder: PropTypes.string,
  label: PropTypes.string,
  subLabel: PropTypes.string,
  error: PropTypes.string,
  className: PropTypes.string,
  hintText: PropTypes.string,
  maxCount: PropTypes.number,
  onChange: PropTypes.func,
  onKeyDown: PropTypes.func,
  autoAdjustHeight: PropTypes.bool,
  spacedOut: PropTypes.bool,
};

export default TextArea;
