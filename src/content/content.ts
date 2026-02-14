/// <reference types="chrome" />

interface StorageItem {
  key: string;
  size: number;
}

interface StorageInfoResponse {
  localStorage: StorageItem[];
  sessionStorage: StorageItem[];
}

function enumerateStorage(storage: Storage): StorageItem[] {
  const items: StorageItem[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key !== null) {
      const value = storage.getItem(key) ?? "";
      items.push({ key, size: new Blob([value]).size });
    }
  }
  return items;
}

chrome.runtime.onMessage.addListener(
  (
    message: { type: string; target?: string },
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: StorageInfoResponse | { success: boolean }) => void,
  ) => {
    if (message.type === "GET_STORAGE_INFO") {
      const result: StorageInfoResponse = {
        localStorage: enumerateStorage(window.localStorage),
        sessionStorage: enumerateStorage(window.sessionStorage),
      };
      sendResponse(result);
    }

    if (message.type === "CLEAR_STORAGE") {
      const target = message.target ?? "all";
      if (target === "localStorage" || target === "all") {
        window.localStorage.clear();
      }
      if (target === "sessionStorage" || target === "all") {
        window.sessionStorage.clear();
      }
      sendResponse({ success: true });
    }

    return true;
  },
);
