async function setStorageItem(key, value) {
  if (!chrome.storage || !chrome.storage.local) {
    console.error('chrome.storage.local is undefined');
    throw new Error('Storage API unavailable');
  }
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [key]: value }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

async function getStorageItem(key) {
  if (!chrome.storage || !chrome.storage.local) {
    console.error('chrome.storage.local is undefined');
    throw new Error('Storage API unavailable');
  }
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([key], (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(result[key]);
      }
    });
  });
}

async function getPrefs() {
  const defaults = {
    method: 1, // 1 = Telex only
    onOff: 1,
    ckSpell: 1,
    oldAccent: 1,
  };

  try {
    const [method, onOff, ckSpell, oldAccent] = await Promise.all([
      getStorageItem('method'),
      getStorageItem('onOff'),
      getStorageItem('ckSpell'),
      getStorageItem('oldAccent'),
    ]);

    return {
      method: method !== undefined ? parseInt(method) : defaults.method,
      onOff: onOff !== undefined ? parseInt(onOff) : defaults.onOff,
      ckSpell: ckSpell !== undefined ? parseInt(ckSpell) : defaults.ckSpell,
      oldAccent:
        oldAccent !== undefined ? parseInt(oldAccent) : defaults.oldAccent,
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
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      // Only send messages to tabs with http or https URLs
      if (
        tab.url &&
        (tab.url.startsWith('http://') || tab.url.startsWith('https://'))
      ) {
        try {
          await chrome.tabs.sendMessage(tab.id, prefs);
        } catch (e) {
          console.warn(
            `Could not send message to tab ${tab.id} (${tab.url}):`,
            e.message
          );
        }
      } else {
        console.debug(
          `Skipping tab ${tab.id}: Non-http/https URL (${tab.url || 'no URL'})`
        );
      }
    }
    await updateIcon(prefs);
  } catch (e) {
    console.error('Error in updateAllTabs:', e);
  }
}

async function updateIcon(prefs) {
  try {
    const txt = { text: prefs.onOff == 1 ? 'on' : 'off' };
    const bg = {
      color: prefs.onOff == 1 ? [0, 255, 0, 255] : [255, 0, 0, 255],
    };

    await chrome.action.setBadgeText(txt);
    await chrome.action.setBadgeBackgroundColor(bg);
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
  if (!chrome.contextMenus) {
    console.warn('chrome.contextMenus is undefined; skipping menu creation');
    return;
  }
  chrome.contextMenus.create({
    id: 'avim-parent',
    title: 'AVIM',
    contexts: ['selection'],
  });
  chrome.contextMenus.create({
    id: 'avim-demo',
    title: 'AVIM Demo',
    contexts: ['selection'],
    parentId: 'avim-parent',
  });
}

async function init() {
  try {
    console.log('Initializing background script');
    const prefs = await getPrefs();
    const defaults = { method: 0, onOff: 1, ckSpell: 1, oldAccent: 1 };

    // Set defaults if not already set
    if (prefs.method === undefined)
      await setStorageItem('method', defaults.method);
    if (prefs.onOff === undefined)
      await setStorageItem('onOff', defaults.onOff);
    if (prefs.ckSpell === undefined)
      await setStorageItem('ckSpell', defaults.ckSpell);
    if (prefs.oldAccent === undefined)
      await setStorageItem('oldAccent', defaults.oldAccent);

    await updateIcon(prefs);

    // Register context menu click handler only if contextMenus API is available
    if (chrome.contextMenus && chrome.contextMenus.onClicked) {
      chrome.contextMenus.onClicked.addListener((info, tab) => {
        if (info.menuItemId === 'avim-demo') {
          genericOnClick(info, tab);
        }
      });
      // Uncomment to enable context menus (requires "contextMenus" permission)
      // createMenus();
    } else {
      console.warn(
        'chrome.contextMenus.onClicked is undefined; skipping listener registration'
      );
    }
  } catch (e) {
    console.error('Error in init:', e);
  }
}

// Register message listener
chrome.runtime.onMessage.addListener(processRequest);

// Initialize on extension install or update
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed or updated');
  init();
});
