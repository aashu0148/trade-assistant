import React, { useEffect, useState } from "react";

import styles from "./Toggle.module.scss";

function Toggle({
  className,
  textClassName,
  itemClassName,
  activeItemClassName,
  options = [],
  selected = "",
  onChange,
}) {
  const [selectedItem, setSelectedItem] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const handleChange = (item, index) => {
    setSelectedItem(item.value);
    setSelectedIndex(index);

    if (onChange) onChange(item);
  };

  useEffect(() => {
    if (selected == selectedItem || !selected) return;

    setSelectedItem(selected);
    setSelectedIndex(
      options.some((item) => item.value == selected)
        ? options.findIndex((item) => item.value == selected)
        : -1
    );
  }, [selected]);

  return (
    <div className={`${styles.container} ${className || ""}`}>
      <div
        className={`${styles.cover} ${
          selectedIndex > -1 ? styles.activeCover : ""
        }`}
        style={{
          left: `${(100 / options.length) * selectedIndex}%`,
          width: `${100 / options.length}%`,
        }}
      />

      {options.map((item, i) => (
        <div
          className={`${styles.item} ${itemClassName || ""} ${
            i == selectedIndex
              ? `${styles.activeItem} ${activeItemClassName || ""}`
              : ""
          }`}
          key={item.value}
          title={item.title || item.label}
          onClick={() => handleChange(item, i)}
        >
          {item.icon && item.icon}

          {item.label && (
            <p className={`${styles.text} ${textClassName || ""}`}>
              {item.label}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export default Toggle;
