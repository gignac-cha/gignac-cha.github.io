// cookie.ts
var cookieStore = window.cookieStore ?? {
  get: (name) => {
    const prefix = `${name}=`;
    const found = document.cookie.split("; ").find((entry) => entry.startsWith(prefix));
    return Promise.resolve(found ? { name, value: found.slice(prefix.length) } : null);
  },
  set: (options) => {
    const parts = [`${options.name}=${options.value}`];
    parts.push(`Path=${options.path ?? "/"}`);
    if (typeof options.expires === "number") {
      parts.push(`Expires=${new Date(options.expires).toUTCString()}`);
    }
    parts.push(`SameSite=${options.sameSite ?? "lax"}`);
    if (options.secure ?? location.protocol === "https:") {
      parts.push("Secure");
    }
    document.cookie = parts.join("; ");
    return Promise.resolve();
  }
};
var readCookie = async (key) => {
  const entry = await cookieStore.get(key).catch(() => null);
  return entry?.value;
};
var writeCookie = async (key, value) => {
  const expires = Date.now() + 60 * 60 * 24 * 400 * 1e3;
  await cookieStore.set({ name: key, value, path: "/", expires, sameSite: "lax" }).catch(() => {
  });
};

// indexedDB.ts
var open = (name) => new Promise((resolve, reject) => {
  const request = indexedDB.open(name, 1);
  request.addEventListener("upgradeneeded", () => {
    request.result.createObjectStore(name);
  });
  request.addEventListener("success", () => resolve(request.result));
  request.addEventListener("error", () => reject(request.error));
});
var readDatabase = async (key) => {
  const database = await open(key);
  return new Promise((resolve) => {
    const request = database.transaction(key, "readonly").objectStore(key).get(key);
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => resolve(void 0));
  });
};
var writeDatabase = async (key, value) => {
  const database = await open(key);
  return new Promise((resolve) => {
    const transaction = database.transaction(key, "readwrite");
    transaction.objectStore(key).put(value, key);
    transaction.addEventListener("complete", () => resolve());
    transaction.addEventListener("error", () => resolve());
  });
};

// localStorage.ts
var readLocal = (key) => {
  try {
    return localStorage.getItem(key) ?? void 0;
  } catch {
    return void 0;
  }
};
var writeLocal = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
  }
};

// sessionStorage.ts
var readSession = (key) => {
  try {
    return sessionStorage.getItem(key) ?? void 0;
  } catch {
    return void 0;
  }
};
var writeSession = (key, value) => {
  try {
    sessionStorage.setItem(key, value);
  } catch {
  }
};

// footprint.ts
var collect = () => {
  const connection = "connection" in navigator ? navigator.connection : void 0;
  const userAgentData = "userAgentData" in navigator ? navigator.userAgentData : void 0;
  const documentMode = "documentMode" in document ? document.documentMode : void 0;
  const intl = Intl.DateTimeFormat().resolvedOptions();
  return {
    location: {
      href: location.href,
      pathname: location.pathname,
      search: location.search,
      hash: location.hash
    },
    document: {
      referrer: document.referrer,
      documentMode
    },
    navigator: {
      userAgent: navigator.userAgent,
      userAgentHints: {
        brands: userAgentData?.brands,
        mobile: userAgentData?.mobile,
        platform: userAgentData?.platform
      }
    },
    connection: {
      effectiveType: connection?.effectiveType,
      downlink: connection?.downlink,
      rtt: connection?.rtt,
      saveData: connection?.saveData
    },
    screen: {
      width: screen.width,
      height: screen.height,
      colorDepth: screen.colorDepth,
      pixelDepth: screen.pixelDepth,
      orientation: screen.orientation.type
    },
    window: {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      outerWidth: window.outerWidth,
      outerHeight: window.outerHeight,
      devicePixelRatio: window.devicePixelRatio
    },
    intl: {
      locale: intl.locale,
      timeZone: intl.timeZone
    },
    colorScheme: matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  };
};
var send = (endpoint, payload = collect()) => {
  const body = JSON.stringify(payload);
  const blob = new Blob([body], { type: "text/plain; charset=utf-8" });
  if (typeof navigator.sendBeacon === "function" && navigator.sendBeacon(endpoint, blob)) {
    return true;
  }
  fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "text/plain; charset=utf-8" },
    body,
    keepalive: true
  }).catch(() => {
  });
  return false;
};
var KEY = "footprint";
var identify = async () => {
  const existing = await readCookie(KEY) ?? readLocal(KEY) ?? readSession(KEY) ?? await readDatabase(KEY).catch(() => void 0);
  const uuid = existing ?? crypto.randomUUID();
  await writeCookie(KEY, uuid);
  writeLocal(KEY, uuid);
  writeSession(KEY, uuid);
  await writeDatabase(KEY, uuid).catch(() => {
  });
  return uuid;
};
export {
  collect,
  identify,
  send
};
