import React, { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff } from "react-feather";

import { handleNumericInputKeyDown } from "utils/util";
import { arrowDownIcon, arrowUpIcon } from "utils/svgs";

import styles from "./InputControl.module.scss";

const InputControl = forwardRef(
  (
    {
      subLabel,
      label,
      error,
      textInsideInput,
      className,
      containerClassName,
      hintClassName,
      inputClass,
      password = false,
      hintText = "",
      icon,
      numericInput = false,
      onChange,
      preventChangeByDragging = false,
      containerStyles = {},
      ...props
    },
    ref
  ) => {
    let onChangeFunc = useRef(onChange);
    let mouseDetails = useRef({
      down: false,
      startX: 0,
      startY: 0,
      initialValue: NaN,
    });
    let inputVal = useRef("");

    const [visible, setVisible] = useState(password ? false : true);

    const handleNumericControlMouseDown = (event) => {
      if (preventChangeByDragging || props.disabled) return;

      mouseDetails.current.down = true;
      mouseDetails.current.startX = event.pageX;
      mouseDetails.current.startY = event.pageY;
      mouseDetails.current.initialValue = parseInt(inputVal.current) || 0;
    };

    const handleMouseUp = () => {
      mouseDetails.current.down = false;
    };

    const handleMouseMove = (event) => {
      if (!mouseDetails.current?.down) return;

      const y = event.pageY;

      let dy = mouseDetails.current?.startY - y;

      if (isNaN(dy)) return;
      if (Math.abs(dy) < 20) dy /= 2;
      else if (Math.abs(dy) > 100) dy *= 1.5;

      const newValue = mouseDetails.current?.initialValue + parseInt(dy);
      const min = isNaN(props?.min) ? -1000 : props.min;
      const max = isNaN(props?.max) ? 1000 : props.max;
      if (
        newValue >= min &&
        newValue <= max &&
        typeof onChangeFunc.current == "function"
      ) {
        inputVal.current = newValue;
        onChangeFunc.current({
          target: {
            value: newValue,
          },
        });
      }
    };

    const handleControlIconClick = (icon = "up") => {
      const newVal =
        icon == "up"
          ? inputVal.current + 1
          : icon == "down"
          ? inputVal.current - 1
          : "";

      if (isNaN(newVal)) return;

      inputVal.current = newVal;
      if (onChange)
        onChange({
          target: {
            value: newVal,
          },
        });
    };

    useEffect(() => {
      if (!isNaN(props?.value) || !isNaN(props?.defaultValue)) {
        inputVal.current = isNaN(props?.value)
          ? props?.defaultValue
          : props.value;
      }

      document.addEventListener("mouseup", handleMouseUp);
      document.addEventListener("mousemove", handleMouseMove);

      return () => {
        document.removeEventListener("mouseup", handleMouseUp);
        document.removeEventListener("mousemove", handleMouseMove);
      };
    }, []);

    useEffect(() => {
      onChangeFunc.current = onChange;
    }, [onChange]);

    useEffect(() => {
      if (props.value !== undefined && props.value !== inputVal.current)
        inputVal.current = props.value;
    }, [props.value]);

    return (
      <div
        className={`${styles.container} ${containerClassName || ""}`}
        style={typeof containerStyles == "object" ? { ...containerStyles } : {}}
      >
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
            onChange={(event) => {
              inputVal = event.target.value;

              if (onChange) onChange(event);
            }}
            {...props}
          />

          {numericInput && !preventChangeByDragging ? (
            <div
              className={styles.numericControl}
              onMouseDown={handleNumericControlMouseDown}
            >
              <div
                className={`${styles.controlIcon} ${styles.up}`}
                onClick={() => handleControlIconClick("up")}
              >
                {arrowUpIcon}
              </div>
              <div
                className={`${styles.controlIcon} ${styles.down}`}
                onClick={() => handleControlIconClick("down")}
              >
                {arrowDownIcon}
              </div>
            </div>
          ) : password ? (
            <div className={styles.eye} onClick={() => setVisible(!visible)}>
              {visible ? <Eye /> : <EyeOff />}
            </div>
          ) : icon ? (
            <div className={styles.icon}>{icon}</div>
          ) : (
            ""
          )}
        </div>
        {hintText ? (
          <p className={`${styles.hint} ${hintClassName || ""}`}>{hintText}</p>
        ) : (
          ""
        )}
        {error ? <p className={styles.errorMsg}>{error}</p> : ""}
      </div>
    );
  }
);

export default InputControl;
