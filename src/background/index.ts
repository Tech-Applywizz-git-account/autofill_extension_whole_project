/**
 * Background service worker for Chrome Extension
 * Handles extension lifecycle, messaging, and profile management
 */

import { loadProfile, hasCompleteProfile } from "../core/storage/profileStorage";
import { CONFIG } from "../config";

// Install/update handler
chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === "install") {
        console.log("[Autofill] Extension installed");

        // Check if profile exists
        const hasProfile = await hasCompleteProfile();

        if (!hasProfile) {
            // Open onboarding page
            chrome.tabs.create({
                url: chrome.runtime.getURL("onboarding.html"),
            });
        }
    }

    if (details.reason === "update") {
        console.log("[Autofill] Extension updated");
    }
});

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
    // Open settings/options page
    chrome.runtime.openOptionsPage();
});

// Handle messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "checkProfile") {
        hasCompleteProfile().then((exists: boolean) => {
            sendResponse({ exists });
        });
        return true; // Async response
    }

    if (message.action === "getProfile") {
        loadProfile().then((profile: any) => {
            sendResponse({ profile });
        });
        return true;
    }

    if (message.action === "openOnboarding") {
        chrome.tabs.create({
            url: chrome.runtime.getURL("onboarding.html"),
        });
        sendResponse({ success: true });
        return false;
    }

    if (message.action === "trustedClick") {
        handleTrustedClick(sender.tab?.id, message.x, message.y).then(sendResponse);
        return true;
    }

    if (message.action === "trustedType") {
        handleTrustedType(sender.tab?.id, message.text).then(sendResponse);
        return true;
    }

    if (message.action === "runSelenium") {
        const aiUrl = CONFIG.API.AI_SERVICE;
        fetch(`${aiUrl}/run`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': CONFIG.API.AI_API_KEY
            },
            body: JSON.stringify(message.plan)
        })
            .then(async (res) => {
                const text = await res.text();
                console.log('[Background] Selenium response status:', res.status);
                console.log('[Background] Selenium response body:', text);

                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}: ${text.substring(0, 200)}`);
                }


                try {
                    const data = JSON.parse(text);
                    sendResponse({ success: true, data });
                } catch (e) {
                    throw new Error(`Invalid JSON response: ${text.substring(0, 200)}`);
                }
            })
            .catch(err => {
                console.error('[Background] Selenium error:', err);
                sendResponse({ success: false, error: err.message });
            });
        return true;
    }

    if (message.action === "askAI") {
        handleAIRequest(message.payload).then(sendResponse);
        return true;
    }

    if (message.action === "scanApplication") {
        handleScanApplication(message.url).then(sendResponse);
        return true;
    }

    if (message.action === "mapAnswers") {
        handleMapAnswers(message.questions).then(sendResponse);
        return true;
    }

    if (message.action === "BROADCAST_SCAN") {
        handleBroadcastScan(sender.tab?.id).then(sendResponse);
        return true;
    }

    if (message.action === "BROADCAST_AUTOFILL") {
        handleBroadcastAutofill(sender.tab?.id, message.payload).then(sendResponse);
        return true;
    }

    // Production scan-and-fill architecture
    if (message.action === "START_AUTOFILL") {
        handleStartAutofill(message.payload).then(sendResponse);
        return true;
    }

    if (message.action === "FIELD_FILL_FAILED") {
        handleFieldFillFailed(message.payload).then(sendResponse);
        return true;
    }

    if (message.action === "REPORT_AUTOFILL_COMPLETE") {
        // Relay to the top frame of the same tab
        if (sender.tab?.id) {
            chrome.tabs.sendMessage(sender.tab.id, {
                type: "AUTOFILL_COMPLETE_RELAY",
                payload: message.payload
            }, { frameId: 0 }).catch(err => {
                console.warn("[Background] Failed to relay completion to top frame:", err.message);
            });
        }
        sendResponse({ success: true });
        return false;
    }

    if (message.action === "proxyFetch") {
        const { url, options } = message;

        // Ensure body is stringified if it's an object
        if (options.body && typeof options.body === 'object') {
            options.body = JSON.stringify(options.body);
        }

        const apiKey = CONFIG.API.AI_API_KEY || '';
        console.log(`[Background] 🛠️ proxyFetch: ${options.method || 'GET'} ${url}`);
        console.log(`[Background] 🔑 API Key Status: ${apiKey ? `Present (${apiKey.substring(0, 3)}...)` : 'MISSING'}`);

        // Add API Key to headers if not present
        const fetchOptions = {
            ...options,
            headers: {
                ...(options.headers || {}),
                'X-API-Key': apiKey
            }
        };

        fetch(url, fetchOptions)
            .then(async (res) => {
                const contentType = res.headers.get("content-type");
                let data;
                if (contentType && contentType.includes("application/json")) {
                    data = await res.json();
                } else {
                    data = { message: await res.text() };
                }

                console.log(`[Background] 📡 proxyFetch Response: ${res.status}`);

                if (res.ok) {
                    sendResponse({ success: true, data, status: res.status });
                } else {
                    console.error(`[Background] ❌ proxyFetch Failed (${res.status}):`, data);
                    sendResponse({
                        success: false,
                        error: data.detail || data.message || `HTTP ${res.status}`,
                        status: res.status
                    });
                }
            })
            .catch((err) => {
                console.error("[Background] ❌ proxyFetch Network Error:", err);
                sendResponse({ success: false, error: err.message });
            });
        return true;
    }

    return false;
});

/**
 * Forward resolved answers to active tab content script for filling
 */
async function handleStartAutofill(payload: any) {
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs[0]?.id) {
            throw new Error('No active tab found');
        }

        console.log('[Background] Forwarding START_AUTOFILL to tab', tabs[0].id);

        const response = await chrome.tabs.sendMessage(tabs[0].id, {
            type: 'START_AUTOFILL',
            payload
        });

        return { success: true, data: response };
    } catch (error: any) {
        console.error("[Background] START_AUTOFILL Error:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Handle field fill failures - optionally trigger Selenium fallback for specific field
 */
async function handleFieldFillFailed(payload: any) {
    try {
        console.log('[Background] Field fill failed:', payload);

        // Optional: Call Selenium fallback for this specific field
        // For now, just log it
        // Future: POST /fallback-fill with field details

        return { success: true, noted: true };
    } catch (error: any) {
        console.error("[Background] FIELD_FILL_FAILED Error:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Handle AI request
 */
async function handleAIRequest(payload: any) {
    try {
        const aiUrl = CONFIG.API.AI_SERVICE;
        const response = await fetch(`${aiUrl}/predict`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': CONFIG.API.AI_API_KEY
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`AI prediction failed (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        return { success: true, data };
    } catch (error: any) {
        console.error("[Background] AI Request Error:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Cache for scan results to prevent repeated scans
 */
const scanCache = new Map<string, { data: any; timestamp: number }>();
const SCAN_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Handle scan application requests by calling Selenium scanner
 */
async function handleScanApplication(url: string) {
    try {
        // Check cache first (Issue #4: prevent repeated scans)
        const cached = scanCache.get(url);
        if (cached && (Date.now() - cached.timestamp) < SCAN_CACHE_DURATION) {
            console.log('[Background] ⚡ Using cached scan results for:', url);
            return { success: true, data: cached.data };
        }

        console.log('[Background] Triggering Selenium scan for:', url);

        const aiUrl = CONFIG.API.AI_SERVICE;
        const response = await fetch(`${aiUrl}/api/selenium/scan`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': CONFIG.API.AI_API_KEY
            },
            body: JSON.stringify({ url })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Scan failed (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        console.log('[Background] Scan complete:', data);

        // Cache the scan result
        scanCache.set(url, { data: data.data, timestamp: Date.now() });
        console.log('[Background] ✅ Scan cached for 5 minutes');

        return { success: true, data: data.data };
    } catch (error: any) {
        console.error("[Background] Scan Error:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Handle answer mapping by delegating to content script
 */
async function handleMapAnswers(questions: any[]) {
    try {
        console.log('[Background] Processing', questions.length, 'questions through mapper');

        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs[0]?.id) {
            throw new Error('No active tab found');
        }

        const response = await chrome.tabs.sendMessage(tabs[0].id, {
            action: 'processQuestions',
            questions
        });

        return response;
    } catch (error: any) {
        console.error("[Background] Mapping Error:", error);
        return { success: false, error: error.message };
    }
}

/**
 * CDP Trusted Click Implementation
 */
async function handleTrustedClick(tabId: number | undefined, x: number, y: number) {
    if (!tabId) return { success: false, error: "No tab ID" };
    const target = { tabId };

    try {
        await chrome.debugger.attach(target, "1.3");

        // Mouse Press
        await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", {
            type: "mousePressed",
            x, y,
            button: "left",
            clickCount: 1
        });

        // Mouse Release
        await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", {
            type: "mouseReleased",
            x, y,
            button: "left",
            clickCount: 1
        });

        await chrome.debugger.detach(target);
        return { success: true };
    } catch (e: any) {
        console.error("[Debugger] Click failed", e);
        try { await chrome.debugger.detach(target); } catch { }
        return { success: false, error: e.message };
    }
}

/**
 * CDP Trusted Type Implementation
 */
async function handleTrustedType(tabId: number | undefined, text: string) {
    if (!tabId) return { success: false, error: "No tab ID" };
    const target = { tabId };

    try {
        await chrome.debugger.attach(target, "1.3");

        for (const char of text) {
            await chrome.debugger.sendCommand(target, "Input.dispatchKeyEvent", {
                type: "keyDown",
                text: char,
            });
            await chrome.debugger.sendCommand(target, "Input.dispatchKeyEvent", {
                type: "keyUp",
                text: char,
            });
        }

        await chrome.debugger.detach(target);
        return { success: true };
    } catch (e: any) {
        console.error("[Debugger] Type failed", e);
        try { await chrome.debugger.detach(target); } catch { }
        return { success: false, error: e.message };
    }
}

// Listen for tab updates to inject content script if needed
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete" && tab.url) {
        // Check if this is a job application site
        const isJobSite = await isJobApplicationSite(tab.url);

        if (isJobSite) {
            // Content script is already injected via manifest
            // but we can send a message to trigger rescan
            try {
                await chrome.tabs.sendMessage(tabId, { action: "rescan" });
            } catch (error) {
                // Content script might not be ready yet, ignore
            }
        }
    }
});

/**
 * Detect if URL is likely a job application site
 */
async function isJobApplicationSite(url: string): Promise<boolean> {
    const jobSitePatterns = [
        /workday\.com/i,
        /greenhouse\.io/i,
        /lever\.co/i,
        /icims\.com/i,
        /smartrecruiters\.com/i,
        /jobvite\.com/i,
        /taleo\.net/i,
        /apply/i,
        /careers/i,
        /jobs/i,
    ];

    return jobSitePatterns.some((pattern) => pattern.test(url));
}

/**
 * Broadcast scan request to all frames in the tab and aggregate results
 */
async function handleBroadcastScan(tabId: number | undefined) {
    if (!tabId) return { success: false, error: "No tab ID" };

    try {
        console.log(`[Background] 🔍 Broadcasting scan to all frames in tab ${tabId}`);

        // Get all frames in the tab
        const frames = await chrome.webNavigation.getAllFrames({ tabId });
        if (!frames) {
            console.warn(`[Background] ⚠️ No frames found for tab ${tabId}`);
            return { success: true, questions: [] };
        }
        console.log(`[Background] 🔍 Found ${frames.length} frames`);

        const scanPromises = frames.map(frame =>
            chrome.tabs.sendMessage(tabId, { action: 'PERFORM_SCAN' }, { frameId: frame.frameId })
                .catch(err => {
                    console.warn(`[Background] ⚠️ Frame ${frame.frameId} scan failed:`, err.message);
                    return null;
                })
        );

        const results = await Promise.all(scanPromises);

        // Aggregate questions from all successful frame scans
        const allQuestions = results
            .filter(r => r && r.success && Array.isArray(r.questions))
            .flatMap(r => r.questions);

        console.log(`[Background] ✅ Aggregated ${allQuestions.length} questions from all frames`);
        return { success: true, questions: allQuestions };
    } catch (error: any) {
        console.error("[Background] Broadcast Scan Error:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Broadcast autofill request to all frames in the tab
 */
async function handleBroadcastAutofill(tabId: number | undefined, payload: any) {
    if (!tabId) return { success: false, error: "No tab ID" };

    try {
        console.log(`[Background] 🚀 Broadcasting autofill to all frames in tab ${tabId}`);

        const frames = await chrome.webNavigation.getAllFrames({ tabId });
        if (!frames) {
            console.warn(`[Background] ⚠️ No frames found for tab ${tabId}`);
            return { success: true };
        }

        const fillPromises = frames.map(frame =>
            chrome.tabs.sendMessage(tabId, { action: 'START_AUTOFILL', payload }, { frameId: frame.frameId })
                .catch(err => {
                    console.warn(`[Background] ⚠️ Frame ${frame.frameId} fill failed:`, err.message);
                    return null;
                })
        );

        await Promise.all(fillPromises);
        return { success: true };
    } catch (error: any) {
        console.error("[Background] Broadcast Autofill Error:", error);
        return { success: false, error: error.message };
    }
}

console.log("[Autofill] Background service worker loaded");
