/**
 * Workday Application Detector
 * Detects if the current page is a Workday job application
 */

const LOG_PREFIX = '[WorkdayDetector]';

/**
 * Check if current page is a Workday application
 */
export function isWorkdayApplication(): boolean {
    // Check hostname
    const hostname = window.location.hostname.toLowerCase();
    if (hostname.includes('myworkdayjobs.com') || hostname.includes('workday.com')) {
        console.log(`${LOG_PREFIX} ✅ Detected via hostname: ${hostname}`);
        return true;
    }

    // Check for Workday-specific DOM elements
    const hasWorkdayElements = document.querySelector('[data-automation-id]') !== null;
    if (hasWorkdayElements) {
        console.log(`${LOG_PREFIX} ✅ Detected via data-automation-id attributes`);
        return true;
    }

    // Check for Workday-specific classes
    const hasWorkdayClasses = document.querySelector('.wd-icon, .WDJC') !== null;
    if (hasWorkdayClasses) {
        console.log(`${LOG_PREFIX} ✅ Detected via Workday CSS classes`);
        return true;
    }

    return false;
}
