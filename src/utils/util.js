import { toast } from "react-hot-toast";

export const handleNumericInputKeyDown = (event) => {
  let key = event.key;

  if (
    key === "Backspace" ||
    key === "Tab" ||
    key === "Delete" ||
    key.toLowerCase() === "arrowleft" ||
    key.toLowerCase() === "arrowright" ||
    key.toLowerCase() === "arrowup" ||
    key.toLowerCase() === "arrowdown" ||
    (event.ctrlKey &&
      (key == "v" ||
        key == "V" ||
        key == "c" ||
        key == "C" ||
        key == "a" ||
        key == "A" ||
        key == "x" ||
        key == "X"))
  )
    return;

  if (!/[0-9]/.test(key)) {
    event.returnValue = false;

    if (event.preventDefault) event.preventDefault();
  }
};

export const generateUniqueString = () => {
  return parseInt(Date.now() + Math.random() * 99999999).toString(16);
};

export const validateEmail = (email) => {
  if (!email) return false;
  return /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(email);
};

export const validatePassword = (pass) => {
  if (!pass) return false;
  return /^(?=.*[0-9])(?=.*[!@#$%^&+*])[a-zA-Z0-9!@#$%^&+*]{6,18}$/.test(pass);
};

export const getFileHashSha256 = async (blob) => {
  if (!blob) return;

  const uint8Array = new Uint8Array(await blob.arrayBuffer());
  const hashBuffer = await crypto.subtle.digest("SHA-256", uint8Array);
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  return hashArray.map((h) => h.toString(16).padStart(2, "0")).join("");
};

export function formatSecondsToHrMinSec(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = parseInt(seconds % 60);

  return `${hours}hr ${minutes}min ${remainingSeconds}s`;
}

export const getDateFormatted = (val, short = false, excludeYear = false) => {
  if (!val) return "";
  const date = new Date(val);
  var day = date.toLocaleString("en-in", { day: "numeric" });
  var month = date.toLocaleString("en-in", {
    month: short ? "short" : "long",
  });
  var year = date.toLocaleString("en-in", { year: "numeric" });

  if (excludeYear) return `${day} ${month}`;
  else return `${day} ${month}, ${year}`;
};

export function getTimeFormatted(value, includeSeconds = false) {
  if (!value) return;

  const date = new Date(value);
  let hours = date?.getHours();
  let minutes = date?.getMinutes();
  let seconds = date?.getSeconds();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  minutes = minutes < 10 ? "0" + minutes : minutes;
  const strTime =
    hours + ":" + minutes + (includeSeconds ? `:${seconds} ` : " ") + ampm;

  return strTime;
}

export function shuffleArray(arr = []) {
  if (!Array.isArray(arr) || !arr.length) return;

  const array = [...arr];
  let currentIndex = array.length,
    randomIndex;

  // While there remain elements to shuffle.
  while (currentIndex != 0) {
    // Pick a remaining element.
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ];
  }

  return array;
}

export function getRandomNumber(a, b) {
  if (a > b) {
    [a, b] = [b, a];
  }

  const range = b - a + 1;

  const randomNumber = Math.floor(Math.random() * range) + a;

  return randomNumber;
}

export function formatTime(val, giveMilliseconds = false) {
  if (!val) return "";

  const date = new Date(val);

  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  const milliSeconds = String(date.getMilliseconds()).padStart(2, "0");

  return `${hours}:${minutes}:${seconds}${
    giveMilliseconds ? `:${milliSeconds}` : ""
  }`;
}

export const nearlyEquateNums = (a, b, dx = 1) => Math.abs(a - b) <= dx;

export function calculateAngle(x, y) {
  // here y = y2-y1 and x = x2-x1
  const radians = Math.atan2(y, x);
  const degrees = radians * (180 / Math.PI);
  return degrees;
}

export const copyToClipboard = async (
  text,
  toastOptions = { hideToast: false, toastMessage: "" }
) => {
  const { hideToast = false, toastMessage = "" } = toastOptions;

  try {
    await window.navigator.clipboard.writeText(text);

    if (!hideToast) toast.success(toastMessage || "Text copied to clipboard");
  } catch (err) {
    console.error("Failed to copy: ", err);
  }
};

export const getTradeLabels = (trades) =>
  trades.map((item) => {
    const isBuyTrade = item.type == "buy";
    let { startPrice: trigger, tradeHigh, tradeLow, target, sl, status } = item;
    const targetLength = Math.abs(trigger - target);
    const slLength = Math.abs(trigger - sl);
    const t1 = isBuyTrade ? trigger + slLength : trigger - slLength;
    const t1Length = Math.abs(trigger - t1);
    const t1PercentOfTarget = (t1Length / targetLength) * 100;
    const t1Succeeded =
      (isBuyTrade && tradeHigh > t1) || (!isBuyTrade && tradeLow < t1);

    // t1Length should be < 80% of targetLength
    const useTargetOne = t1PercentOfTarget < 80;

    if (status == "profit") return "profit";
    else if (useTargetOne && t1Succeeded) return "half-profit";
    else if (status == "loss") return "loss";
    else return "unfinished";
  });
