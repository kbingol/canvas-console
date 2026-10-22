import {
  createLightTheme,
  type BrandVariants,
  type Theme,
} from "@fluentui/react-components";

const graphite: BrandVariants = {
  10: "#080808",
  20: "#141414",
  30: "#202020",
  40: "#282828",
  50: "#303030",
  60: "#383838",
  70: "#414141",
  80: "#494949",
  90: "#575757",
  100: "#666666",
  110: "#777777",
  120: "#8a8a8a",
  130: "#a1a1a1",
  140: "#bcbcbc",
  150: "#d9d9d9",
  160: "#f2f2f2",
};

export const consoleTheme: Theme = {
  ...createLightTheme(graphite),
  fontFamilyBase: '"Segoe UI Variable", "Segoe UI", sans-serif',
  fontFamilyNumeric: '"Segoe UI Variable", "Segoe UI", sans-serif',
  colorBrandBackground: "#282828",
  colorBrandBackgroundHover: "#3b3b3b",
  colorBrandBackgroundPressed: "#171717",
  colorBrandForeground1: "#242424",
  colorBrandForeground2: "#242424",
  colorBrandStroke1: "#494949",
  colorCompoundBrandBackground: "#333333",
  colorCompoundBrandBackgroundHover: "#484848",
  colorCompoundBrandBackgroundPressed: "#202020",
  colorCompoundBrandForeground1: "#333333",
  colorCompoundBrandStroke: "#333333",
  borderRadiusMedium: "4px",
};

export const theme = consoleTheme;
