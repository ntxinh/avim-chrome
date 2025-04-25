async function setStorageItem(key, value) {
  const browser = window.browser || chrome;
  if (!browser.storage || !browser.storage.local) {
    console.error('browser.storage.local is undefined');
    throw new Error('Storage API unavailable');
  }
  return new Promise((resolve, reject) => {
    browser.storage.local.set({ [key]: value }, () => {
      if (browser.runtime.lastError) {
        reject(new Error(browser.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

async function getStorageItem(key) {
  const browser = window.browser || chrome;
  if (!browser.storage || !browser.storage.local) {
    console.error('browser.storage.local is undefined');
    throw new Error('Storage API unavailable');
  }
  return new Promise((resolve, reject) => {
    browser.storage.local.get([key], (result) => {
      if (browser.runtime.lastError) {
        reject(new Error(browser.runtime.lastError.message));
      } else {
        resolve(result[key]);
      }
    });
  });
}

async function getPrefs() {
  const defaults = {
    method: 1,
    onOff: 1,
    ckSpell: 1,
    oldAccent: 1
  };

  try {
    const [method, onOff, ckSpell, oldAccent] = await Promise.all([
      getStorageItem('method'),
      getStorageItem('onOff'),
      getStorageItem('ckSpell'),
      getStorageItem('oldAccent')
    ]);

    return {
      method: method !== undefined ? parseInt(method) : defaults.method,
      onOff: onOff !== undefined ? parseInt(onOff) : defaults.onOff,
      ckSpell: ckSpell !== undefined ? parseInt(ckSpell) : defaults.ckSpell,
      oldAccent: oldAccent !== undefined ? parseInt(oldAccent) : defaults.oldAccent
    };
  } catch (e) {
    console.error('Error in getPrefs:', e);
    return defaults;
  }
}

async function turnAvim() {
  try {
    const onOff = await getStorageItem('onOff');
    const newOnOff = onOff == '1' ? '0' : '1';
    await setStorageItem('onOff', newOnOff);
    const prefs = await getPrefs();
    await updateAllTabs(prefs);
  } catch (e) {
    console.error('Error in turnAvim:', e);
  }
}

async function updateAllTabs(prefs) {
  const browser = window.browser || chrome;
  try {
    const tabs = await browser.tabs.query({});
    for (const tab of tabs) {
      if (tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
        try {
          await browser.tabs.sendMessage(tab.id, prefs);
        } catch (e) {
          console.warn(`Could not send message to tab ${tab.id} (${tab.url}):`, e.message);
        }
      } else {
        console.debug(`Skipping tab ${tab.id}: Non-http/https URL (${tab.url || 'no URL'})`);
      }
    }
    await updateIcon(prefs);
  } catch (e) {
    console.error('Error in updateAllTabs:', e);
  }
}

async function updateIcon(prefs) {
  const browser = window.browser || chrome;
  try {
    const txt = { text: prefs.onOff == 1 ? "on" : "off" };
    const bg = { color: prefs.onOff == 1 ? [0, 255, 0, 255] : [255, 0, 0, 255] };

    // Use action for Manifest V3 compatibility
    await browser.action.setBadgeText(txt);
    await browser.action.setBadgeBackgroundColor(bg);
  } catch (e) {
    console.error('Error in updateIcon:', e);
  }
}

async function savePrefs(request) {
  try {
    if (typeof request.method !== 'undefined') {
      await setStorageItem('method', request.method);
    }
    if (typeof request.onOff !== 'undefined') {
      await setStorageItem('onOff', request.onOff);
    }
    if (typeof request.ckSpell !== 'undefined') {
      await setStorageItem('ckSpell', request.ckSpell);
    }
    if (typeof request.oldAccent !== 'undefined') {
      await setStorageItem('oldAccent', request.oldAccent);
    }

    const prefs = await getPrefs();
    await updateAllTabs(prefs);
  } catch (e) {
    console.error('Error in savePrefs:', e);
  }
}

function processRequest(request, sender, sendResponse) {
  if (request.get_prefs) {
    getPrefs()
      .then((prefs) => sendResponse(prefs))
      .catch((e) => {
        console.error('Error processing get_prefs:', e);
        sendResponse({ error: e.message });
      });
    return true;
  }

  if (request.save_prefs) {
    savePrefs(request)
      .then(() => sendResponse({}))
      .catch((e) => {
        console.error('Error processing save_prefs:', e);
        sendResponse({ error: e.message });
      });
    return true;
  }

  if (request.turn_avim) {
    turnAvim()
      .then(() => sendResponse({}))
      .catch((e) => {
        console.error('Error processing turn_avim:', e);
        sendResponse({ error: e.message });
      });
    return true;
  }
}

function genericOnClick(info, tab) {
  console.log('AVIM Demo clicked:', info, tab);
}

function createMenus() {
  const browser = window.browser || chrome;
  if (!browser.contextMenus) {
    console.warn('browser.contextMenus is undefined; skipping menu creation');
    return;
  }
  browser.contextMenus.create({
    id: "avim-parent",
    title: "AVIM",
    contexts: ["selection"]
  });
  browser.contextMenus.create({
    id: "avim-demo",
    title: "AVIM Demo",
    contexts: ["selection"],
    parentId: "avim-parent"
  });
}

async function init() {
  try {
    console.log('Initializing background script');
    const prefs = await getPrefs();
    const defaults = { method: 0, onOff: 1, ckSpell: 1, oldAccent: 1 };

    if (prefs.method === undefined) await setStorageItem('method', defaults.method);
    if (prefs.onOff === undefined) await setStorageItem('onOff', defaults.onOff);
    if (prefs.ckSpell === undefined) await setStorageItem('ckSpell', defaults.ckSpell);
    if (prefs.oldAccent === undefined) await setStorageItem('oldAccent', defaults.oldAccent);

    await updateIcon(prefs);

    const browser = window.browser || chrome;
    if (browser.contextMenus && browser.contextMenus.onClicked) {
      browser.contextMenus.onClicked.addListener((info, tab) => {
        if (info.menuItemId === "avim-demo") {
          genericOnClick(info, tab);
        }
      });
      // Uncomment to enable context menus
      // createMenus();
    } else {
      console.warn('browser.contextMenus.onClicked is undefined; skipping listener registration');
    }
  } catch (e) {
    console.error('Error in init:', e);
  }
}

const browser = window.browser || chrome;
browser.runtime.onMessage.addListener(processRequest);
browser.runtime.onInstalled.addListener(() => {
  console.log('Extension installed or updated');
  init();
});
