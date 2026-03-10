// extension/src/content/ui/OverlayPanel.tsx
import React, { useState, useEffect, useRef } from "react";
import { createRoot, Root } from "react-dom/client";
import { DetectedField, QuestionSection, FieldType } from "../../types/fieldDetection";
import { updateProfileField, loadProfile, saveProfile } from "../../core/storage/profileStorage";
import { EMPTY_PROFILE } from "../../types/canonicalProfile";
import { patternStorage } from "../../core/storage/patternStorage";
import { fillField } from "../actions/fieldFiller";
import { FormScanner } from "../scanner/formScanner";
import { CONFIG } from "../../config";
import { AnalyticsTracker } from "../../core/analytics/AnalyticsTracker";
import { getAllCached } from "../../core/storage/aiResponseCache";


// CSS Styles specifically for the Shadow DOM injection
const STYLES = `
.autofill-floating-container {
  position: fixed;
  z-index: 2147483647;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  user-select: none;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Floating Icon State */
.autofill-floating-container.icon {
  width: 60px;
  height: 60px;
}

.floating-icon {
  width: 60px;
  height: 60px;
  background: white;
  border-radius: 50% 50% 0 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  border: 4px solid #00d084;
  /* JobRight green */
  transition: transform 0.2s;
}

.icon-bird {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50% 50% 0 50%;
  overflow: hidden;
}

.floating-icon:hover {
  transform: scale(1.05);
}

.floating-icon:active {
  cursor: grabbing;
}

.close-x {
  position: absolute;
  top: -10px;
  left: -10px;
  width: 24px;
  height: 24px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: #666;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.2s;
}

.close-x:hover {
  background: #f8f9fa;
  color: #dc3545;
  border-color: #dc3545;
}

/* Action Menu State */
.autofill-floating-container.menu {
  width: 220px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  border: 1px solid #eee;
}

.menu-header {
  padding: 8px 12px;
  background: #f8f9fa;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #eee;
}

.drag-handle {
  color: #ccc;
  cursor: grab;
  font-size: 18px;
}

.menu-content {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.run-autofill-btn {
  background: #00d084;
  color: white;
  border: none;
  padding: 12px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: background 0.2s;
}

.run-autofill-btn:hover {
  background: #00b371;
}

.workday-link {
  background: #0073e6 !important;
}

.workday-link:hover {
  background: #005bb5 !important;
}

.view-details-btn {
  background: #f1f3f5;
  color: #495057;
  border: none;
  padding: 8px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.view-details-btn:hover {
  background: #e9ecef;
}

/* Details Panel State */
.details-panel {
  width: 400px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: 80vh;
}

.autofill-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: linear-gradient(135deg, #00d084 0%, #00b371 100%);
  color: white;
}

.autofill-header h3 {
  margin: 0;
  font-size: 16px;
}

.header-actions {
  display: flex;
  gap: 6px;
  align-items: center;
}

.header-actions .action-btn:hover {
  background: rgba(255, 255, 255, 0.25);
  transform: translateY(-1px);
}

/* Feedback Form Styles */
.feedback-container {
  padding: 16px;
  background: #fdfdfd;
  border-top: 1px solid #eee;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.feedback-message {
  font-size: 13px;
  color: #333;
  line-height: 1.5;
  font-weight: 500;
  text-align: center;
}

.feedback-inputs {
  display: flex;
  gap: 15px;
  justify-content: center;
  align-items: center;
}

.feedback-input-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.feedback-input-group label {
  font-size: 10px;
  text-transform: uppercase;
  color: #666;
  font-weight: 700;
}

.feedback-input-group input {
  width: 50px;
  padding: 6px;
  border: 1px solid #ddd;
  border-radius: 4px;
  text-align: center;
  font-size: 14px;
  font-weight: 600;
}

.feedback-submit-btn {
  background: #00d084;
  color: white;
  border: none;
  padding: 10px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.feedback-submit-btn:hover {
  background: #00b371;
  transform: translateY(-1px);
}

.feedback-timer {
  font-size: 11px;
  color: #999;
  text-align: center;
  font-style: italic;
}

.feedback-timer span {
  color: #ff3b30;
  font-weight: 600;
}

.header-actions .action-btn:hover {
  background: rgba(255, 255, 255, 0.25);
}

.scan-header-btn {
  background: white !important;
  color: #00b371 !important;
  border: none !important;
  padding: 4px 12px !important;
  border-radius: 6px !important;
  font-weight: 700 !important;
  font-size: 11px !important;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
  height: 28px;
}

.scan-header-btn:hover {
  background: #f0fdf4 !important;
  transform: translateY(-1px);
}

.view-tabs {
  display: flex;
  background: #f1f3f5;
  padding: 4px;
}

.view-tabs button {
  flex: 1;
  padding: 8px;
  border: none;
  background: none;
  cursor: pointer;
  border-radius: 4px;
}

.view-tabs button.active {
  background: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  color: #00b371;
}

.autofill-content {
  overflow-y: auto;
  padding: 12px;
  flex: 1;
}

.panel-footer {
  padding: 12px;
  border-top: 1px solid #eee;
  background: #f8f9fa;
}

.run-autofill-btn.mini {
  width: 100%;
  padding: 8px;
}

/* Reuse existing FieldItem styles from previous CSS */
.autofill-stats {
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 12px;
}

.stat {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  margin-bottom: 6px;
  padding: 4px 8px;
  background: white;
  border-radius: 6px;
  border: 1px solid #eee;
}

.stat-label {
  font-weight: 600;
  color: #495057;
  min-width: 80px;
}

.stat-value {
  color: #00b371;
  font-weight: bold;
}

.stat-percent {
  background: #00d084;
  color: white;
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 700;
}

.section-filter {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.section-filter button {
  font-size: 10px;
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 12px;
  background: white;
  cursor: pointer;
}

.section-filter button.active {
  background: #00d084;
  color: white;
  border-color: #00d084;
}

.section-filter button.missed {
  border-color: #fa5252;
  color: #fa5252;
}

.section-filter button.missed.active {
  background: #fa5252;
  color: white;
}

.fields-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-item {
  padding: 10px;
  border: 1px solid #eee;
  border-radius: 8px;
  font-size: 12px;
  cursor: pointer;
}

.field-item:hover {
  border-color: #00d084;
}

.field-item.filled {
  border-left: 4px solid #28a745;
}

.field-item.suggested {
  border-left: 4px solid #007bff;
}

.field-item.skipped {
  border-left: 4px solid #fab005;
}

.field-item.failed {
  border-left: 4px solid #fa5252;
}

.field-status.suggested {
  color: #007bff;
  font-style: italic;
}

.field-header {
  display: flex;
  justify-content: space-between;
  font-weight: 500;
  margin-bottom: 4px;
}

.field-details {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  color: #868e96;
  font-size: 10px;
  align-items: center;
  margin-top: 6px;
}

.confidence.high {
  color: #28a745;
}

.edit-btn {
  margin-left: auto;
  color: #00d084;
  background: none;
  border: 1px solid #00d084;
  border-radius: 4px;
  padding: 2px 6px;
  cursor: pointer;
}

.edit-field-ui {
  margin-top: 8px;
  padding: 8px;
  background: #f8f9fa;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.edit-field-ui input,
.edit-field-ui select {
  padding: 6px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.edit-actions {
  display: flex;
  gap: 4px;
  justify-content: flex-end;
}

.save-btn {
  background: #28a745;
  color: white;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
}

.cancel-btn {
  background: #ced4da;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
}

/* Performance Tracker Styles */
.performance-tracker {
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 12px;
  font-size: 11px;
}

.performance-tracker-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #495057;
}

.performance-timeline {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.perf-item {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  color: #6c757d;
}

.perf-label {
  font-weight: 500;
}

.perf-value {
  color: #00b371;
  font-family: monospace;
}

.perf-duration {
  color: #868e96;
  font-size: 10px;
  margin-left: 6px;
}

.perf-total {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #dee2e6;
  display: flex;
  justify-content: space-between;
  font-weight: 600;
  color: #212529;
}

.perf-total-value {
  color: #00d084;
  font-size: 13px;
}

.field-status.failed {
  color: #fa5252;
  font-weight: 500;
}

/* Settings View Styles */
.settings-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px 0;
}

.settings-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px;
  background: white;
  border: 1px solid #eee;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 4px rgba(0,0,0,0.02);
}

.settings-item:hover {
  border-color: #00d084;
  background: #fdfdfd;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.05);
}

.settings-item.danger:hover {
  border-color: #fa5252;
  background: #fffafa;
}

.settings-item-title {
  font-weight: 700;
  font-size: 14px;
  color: #212529;
  display: flex;
  align-items: center;
  gap: 10px;
}

.settings-item-desc {
  font-size: 11px;
  color: #6c757d;
  line-height: 1.5;
}

.settings-item-btn {
  margin-top: 4px;
  font-size: 11px;
  font-weight: 700;
  color: #00d084;
  text-align: right;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.settings-item.danger .settings-item-btn {
  color: #fa5252;
}

.gear-btn {
  background: none;
  border: none;
  color: white;
  font-size: 20px;
  padding: 4px;
  cursor: pointer;
  opacity: 0.85;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.gear-btn:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.15);
  transform: rotate(45deg);
}

.completion-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(2px);
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.completion-notification {
  background: white;
  border-radius: 16px;
  padding: 24px;
  width: 300px;
  box-shadow: 0 20px 50px rgba(0,0,0,0.3);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  animation: modalPop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes modalPop {
  from { opacity: 0; transform: scale(0.8); }
  to { opacity: 1; transform: scale(1); }
}

.completion-header {
  font-weight: 700;
  font-size: 18px;
  color: #212529;
  text-align: center;
}

.completion-stats {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: 8px;
  font-weight: 500;
}

.stat-row.success {
  background: rgba(0, 208, 132, 0.1);
  color: #00b371;
}

.stat-row.missed {
  background: rgba(250, 82, 82, 0.1);
  color: #fa5252;
}

.missed-questions-list {
  width: 100%;
  max-height: 120px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: #f8f9fa;
  padding: 8px;
  border-radius: 8px;
  border: 1px solid #eee;
  font-size: 11px;
}

.missed-question-item {
  color: #495057;
  padding: 4px 8px;
  background: white;
  border-radius: 4px;
  border-left: 3px solid #fa5252;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.close-notification-btn {
  background: #212529;
  color: white;
  border: none;
  padding: 8px 20px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  width: 100%;
  margin-top: 8px;
}

.close-notification-btn:hover {
  background: #343a40;
}

@keyframes fadeInOut {
  0% { opacity: 0; transform: translate(-50%, 20px); }
  15% { opacity: 1; transform: translate(-50%, 0); }
  85% { opacity: 1; transform: translate(-50%, 0); }
  100% { opacity: 0; transform: translate(-50%, -20px); }
}

/* Settings Animations */
.settings-item.active {
  opacity: 0.7;
  pointer-events: none;
  animation: pulse 1.5s infinite ease-in-out;
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(0.98); }
  100% { transform: scale(1); }
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(0,0,0,0.1);
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  display: inline-block;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.page-analysis {
  background: #fdfdfd;
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 10px;
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.page-type-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
}

.page-type-badge.multi {
  background: rgba(0, 115, 230, 0.1);
  color: #0073e6;
  border: 1px solid rgba(0, 115, 230, 0.2);
}

.page-type-badge.single {
  background: rgba(0, 208, 132, 0.1);
  color: #00d084;
  border: 1px solid rgba(0, 208, 132, 0.2);
}

.nav-buttons-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.nav-button-chip {
  background: #f1f3f5;
  color: #495057;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 500;
  border: 1px solid #dee2e6;
}
`;

interface OverlayPanelProps {
    fields: DetectedField[];
    onAutoFill: () => Promise<void>;
    onFieldUpdate: (index: number, field: DetectedField) => void;
}

interface PerformanceMetrics {
    scanStarted?: Date;
    scanCompleted?: Date;
    aiQuestionCount?: number;
    aiCalls?: number;
    cacheHits?: number;
    mappingCompleted?: Date;
    fillStarted?: Date;
    fillCompleted?: Date;
    fillProgress?: { current: number; total: number };
}

type ViewState = "ICON" | "MENU" | "DETAILS" | "SETTINGS";

// Helper functions for performance tracking
const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
};

const calculateDuration = (start: Date, end: Date): string => {
    const diffMs = end.getTime() - start.getTime();
    const minutes = Math.floor(diffMs / 60000);
    const seconds = Math.floor((diffMs % 60000) / 1000);

    if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
};

const OverlayPanel: React.FC<OverlayPanelProps> = ({ fields: initialFields, onAutoFill, onFieldUpdate }) => {
    const [viewState, setViewState] = useState<ViewState>("ICON");
    const [position, setPosition] = useState({ x: window.innerWidth - 80, y: 100 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [selectedSection, setSelectedSection] = useState<QuestionSection | "all" | "missed">("all");
    const [viewMode, setViewMode] = useState<"fields" | "resume">("fields");
    const [resumeText, setResumeText] = useState<string>("");
    const [fields, setFields] = useState<DetectedField[]>(initialFields);

    // Sync internal fields state with props (Required when orchestrator rescans)
    useEffect(() => {
        if (initialFields && initialFields.length > 0) {
            setFields(initialFields);
        }
    }, [initialFields]);

    interface CompletionResult {
        successes: number;
        failures: number;
        missedQuestions: string[];
    }
    const [completionResult, setCompletionResult] = useState<CompletionResult | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isClearingCache, setIsClearingCache] = useState(false);
    const [isClearingAll, setIsClearingAll] = useState(false);
    const [isFilling, setIsFilling] = useState(false);
    const [isMapping, setIsMapping] = useState(false);
    const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
        aiCalls: 0,
        cacheHits: 0
    });
    const [fillProgress, setFillProgress] = useState<{ current: number; total: number } | null>(null);
    const [aiStatus, setAIStatus] = useState<string>("");
    const [aiLog, setAILog] = useState<{ question: string; answer: string; cached?: boolean }[]>([]);
    const [statsSummary, setStatsSummary] = useState<{
        users: { total: number; recent_24h: number };
        feedback: { total: number; recent_24h: number };
    } | null>(null);
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' } | null>(null);
    const [pageType, setPageType] = useState<'single' | 'multi' | null>(null);
    const [navigationButtons, setNavigationButtons] = useState<string[]>([]);

    // Manual Feedback State
    const [manualSuccess, setManualSuccess] = useState<number>(0);
    const [manualFail, setManualFail] = useState<number>(0);
    const [totalAttempted, setTotalAttempted] = useState<number>(0);
    const [feedbackTimer, setFeedbackTimer] = useState<number>(60);
    const [isFeedbackVisible, setIsFeedbackVisible] = useState(false);
    const [showFeedbackIntimation, setShowFeedbackIntimation] = useState(false);
    const [feedbackSubmittedMessage, setFeedbackSubmittedMessage] = useState<string | null>(null);
    const feedbackTimerRef = useRef<any>(null);

    // Handle Feedback Submission (Manual or Auto)
    const submitFeedback = async (isAuto = false) => {
        if (feedbackTimerRef.current) clearInterval(feedbackTimerRef.current);

        // Record the message before hiding the intimation but don't hide the overall visibility yet
        // so we can show the "Thanks" message in the panel
        setFeedbackSubmittedMessage(isAuto ? "Data submitted automatically" : "Thanks for submit");

        setShowFeedbackIntimation(false); // Hide the popup immediately

        const tracker = AnalyticsTracker.getInstance();
        tracker.setManualCounts(manualSuccess, manualFail);

        console.log(`[Ext] Submitting ${isAuto ? 'AUTO' : 'MANUAL'} feedback and syncing patterns...`);

        // 1. Submit Analytics
        const analyticsSuccess = await tracker.submit();

        // 2. Batch Sync Patterns
        try {
            await patternStorage.syncUnsyncedPatterns();
            // Optional: setNotification or just let the "Thanks" message handle it
        } catch (e) {
            console.warn("[Ext] Pattern sync failed:", e);
        }

        // Keep the "Thanks" message visible for 3 seconds, then hide the feedback section entirely
        setTimeout(() => {
            setIsFeedbackVisible(false);
            setFeedbackSubmittedMessage(null);
        }, 3000);
    };

    // Feedback Timer Effect
    useEffect(() => {
        if (isFeedbackVisible && feedbackTimer > 0) {
            feedbackTimerRef.current = setInterval(() => {
                setFeedbackTimer(prev => {
                    if (prev <= 1) {
                        submitFeedback(true); // Auto-submit on timeout
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => {
            if (feedbackTimerRef.current) clearInterval(feedbackTimerRef.current);
        };
    }, [isFeedbackVisible]);

    // Use a ref to always have the latest fields for async closures (like handleScan timeouts)
    const fieldsRef = useRef(fields);
    useEffect(() => {
        fieldsRef.current = fields;
    }, [fields]);

    // Analytics tracker instance
    const trackerRef = useRef(AnalyticsTracker.getInstance());
    const tracker = trackerRef.current;

    // Helper to perform fetch via background script to bypass CORS
    const proxyFetch = async (url: string, options: any = {}): Promise<any> => {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ action: 'proxyFetch', url, options }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else if (response && response.success) {
                    resolve(response.data);
                } else {
                    reject(new Error(response?.error || 'Unknown proxyFetch error'));
                }
            });
        });
    };

    // Fetch stats summary on mount
    useEffect(() => {
        const fetchStats = async () => {
            try {
                const data = await proxyFetch(`${CONFIG.API.STATS_URL}/api/stats/summary`);
                if (data.success) {
                    setStatsSummary({
                        users: data.users,
                        feedback: data.feedback
                    });
                }
            } catch (err) {
                console.warn("[OverlayPanel] Failed to fetch stats summary:", err);
            }
        };
        fetchStats();
    }, []);

    // Detect if current URL is a Workday application
    const [isWorkdayUrl, setIsWorkdayUrl] = useState(window.location.href.toLowerCase().includes('workday'));

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging) {
                setPosition({
                    x: e.clientX - dragOffset.x,
                    y: e.clientY - dragOffset.y
                });
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, dragOffset]);

    useEffect(() => {
        const fetchResume = async () => {
            const profile = await loadProfile();
            if (profile?.metadata?.resumeRawText) {
                setResumeText(profile.metadata.resumeRawText);
            }
        };
        fetchResume();
    }, []);

    // Listen for AI count updates from QuestionMapper
    useEffect(() => {
        const handleAICountUpdate = (e: any) => {
            const count = e.detail?.count;
            if (count !== undefined) {
                console.log(`[OverlayPanel] Received AI count: ${count}`);
                setPerformanceMetrics(prev => ({ ...prev, aiQuestionCount: count }));
            }
        };

        const handleAIProgress = (e: any) => {
            const detail = e.detail;
            if (!detail) return;
            const { current, total, question, status, answer, cached } = detail;

            if (status === 'processing') {
                setAIStatus(`Resolving ${current}/${total}: ${truncate(question, 30)}...`);
            } else if (status === 'complete') {
                setAIStatus(`${current}/${total} resolved`);
                setAILog(prev => [...prev, { question, answer, cached }]);

                setPerformanceMetrics(prev => ({
                    ...prev,
                    aiCalls: (prev.aiCalls || 0) + (cached ? 0 : 1),
                    cacheHits: (prev.cacheHits || 0) + (cached ? 1 : 0)
                }));

                // Track AI call in tracker (only if not cached)
                if (!cached) {
                    tracker.incrementAICall();
                }
            }
        };

        window.addEventListener('AI_COUNT_UPDATE', handleAICountUpdate);
        window.addEventListener('AI_PROGRESS', handleAIProgress);
        return () => {
            window.removeEventListener('AI_COUNT_UPDATE', handleAICountUpdate);
            window.removeEventListener('AI_PROGRESS', handleAIProgress);
        };
    }, [tracker])

    // Listen for pattern sync notifications
    useEffect(() => {
        const handlePatternSynced = (e: any) => {
            const { intent } = e.detail;
            setNotification({ message: `✨ Pattern stored: ${intent}`, type: 'success' });
            setTimeout(() => setNotification(null), 3000);
        };
        window.addEventListener('PATTERN_SYNCED', handlePatternSynced);
        return () => window.removeEventListener('PATTERN_SYNCED', handlePatternSynced);
    }, []);

    // Monitor URL changes to update Workday detection
    useEffect(() => {
        const checkUrl = () => {
            const isWorkday = window.location.href.toLowerCase().includes('workday');
            setIsWorkdayUrl(isWorkday);
        };

        // Check on mount and set up interval to monitor URL changes
        checkUrl();
        const intervalId = setInterval(checkUrl, 1000); // Check every second

        return () => clearInterval(intervalId);
    }, []);

    // Adjust position when view state changes to keep panel within viewport
    useEffect(() => {
        const adjustPositionForViewport = () => {
            let panelWidth = 60; // ICON state default
            let panelHeight = 60;

            if (viewState === "MENU") {
                panelWidth = 220;
                panelHeight = 200; // Approximate height
            } else if (viewState === "DETAILS" || viewState === "SETTINGS") {
                panelWidth = 400;
                panelHeight = Math.min(window.innerHeight * 0.8, 600); // 80vh max
            }

            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const padding = 20; // Keep some padding from edges

            let newX = position.x;
            let newY = position.y;

            // Adjust X position if panel would overflow right edge
            if (position.x + panelWidth > viewportWidth - padding) {
                newX = viewportWidth - panelWidth - padding;
            }

            // Adjust X position if panel would overflow left edge
            if (newX < padding) {
                newX = padding;
            }

            // Adjust Y position if panel would overflow bottom edge
            if (position.y + panelHeight > viewportHeight - padding) {
                newY = viewportHeight - panelHeight - padding;
            }

            // Adjust Y position if panel would overflow top edge
            if (newY < padding) {
                newY = padding;
            }

            // Only update if position changed
            if (newX !== position.x || newY !== position.y) {
                setPosition({ x: newX, y: newY });
            }
        };

        adjustPositionForViewport();
    }, [viewState]); // Run when viewState changes

    const handleFieldUpdate = (index: number, newValue: string) => {
        const updatedFields = [...fields];
        const field = { ...updatedFields[index] };
        field.filled = true;
        field.filledValue = newValue;
        field.skipped = false;
        field.confidence = 1.0;

        updatedFields[index] = field;
        setFields(updatedFields);
        onFieldUpdate(index, field);
    };

    // Calculate stats
    const stats = calculateStats(fields);

    // Group fields by section
    const fieldsBySection = groupBySection(fields);

    // Filter fields
    const filteredFields =
        selectedSection === "all"
            ? fields
            : fields.filter((f) => f.section === selectedSection);

    const handleDragStart = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('.close-x')) return;
        setIsDragging(true);
        setDragOffset({
            x: e.clientX - position.x,
            y: e.clientY - position.y
        });
    };

    const handleIconClick = (e: React.MouseEvent) => {
        if (!isDragging) {
            setViewState(viewState === "ICON" ? "MENU" : "ICON");
        }
    };

    const handleRunAutofill = async () => {
        await onAutoFill();
        // Refresh local fields state if needed, though they might update via props if orchestrator rescans
        setViewState("DETAILS");
    };

    const handleClose = (e: React.MouseEvent) => {
        e.stopPropagation();
        unmountOverlay();
    };

    const handleScan = async () => {
        const jobUrl = window.location.href;
        setViewState("DETAILS"); // Open Detection List immediately

        try {
            // Reset and start analytics tracking
            tracker.reset();
            tracker.startScan();

            // Record scan start time
            const scanStart = new Date();
            setPerformanceMetrics({
                scanStarted: scanStart,
                aiCalls: 0,
                cacheHits: 0
            });
            setAILog([]);
            setAIStatus("");

            console.log('[Ext] 🔍 Broadcasting scan to all frames...');

            // Use BROADCAST_SCAN to gather questions from all iframes
            const scanResponse = await chrome.runtime.sendMessage({ action: 'BROADCAST_SCAN' });
            if (!scanResponse.success) {
                alert('❌ Scan failed: ' + scanResponse.error);
                return;
            }

            const questions = scanResponse.questions;
            const detectedPageType = scanResponse.pageType;
            const detectedNavButtons = scanResponse.navigationButtons;

            console.log(`[Ext] ✓ Found ${questions.length} questions across all frames. Page type: ${detectedPageType}`);
            setPageType(detectedPageType);
            setNavigationButtons(detectedNavButtons);

            // End scan tracking
            tracker.endScan(questions);

            // Record scan complete time
            const scanComplete = new Date();
            setPerformanceMetrics(prev => ({ ...prev, scanCompleted: scanComplete }));

            // Send to QuestionMapper (via background script)
            console.log('[Ext] 🧠 Mapping...');
            tracker.startMapping();
            setIsMapping(true);
            const map = await chrome.runtime.sendMessage({ action: 'mapAnswers', questions: questions });
            setIsMapping(false);
            if (!map.success) { alert('❌ Mapping failed: ' + map.error); return; }

            // End mapping tracking
            tracker.endMapping(map.data);

            // Record mapping complete time
            const mappingComplete = new Date();
            setPerformanceMetrics(prev => ({ ...prev, mappingCompleted: mappingComplete }));

            const c = map.data.filter((a: any) => a.source === 'canonical').length;
            const f = map.data.filter((a: any) => a.source === 'fuzzy').length;
            const ai = map.data.filter((a: any) => a.source === 'AI').length;

            // Update with ACTUAL AI question count
            setPerformanceMetrics(prev => ({ ...prev, aiQuestionCount: ai }));

            // Store for fill execution
            (window as any).__AWL_MAPPED__ = {
                jobUrl,
                answers: map.data,
                activeFrameIds: scanResponse.activeFrameIds || []
            };

            //Convert to DetectedField format for UI display
            const { classifySection } = await import('../index');
            const detectedFields: DetectedField[] = map.data.map((answer: any) => ({
                element: null as any, // Not needed for display-only
                questionText: answer.questionText,
                selector: answer.selector || "",
                fieldType: answer.fieldType as any,
                isRequired: answer.required || false,
                options: answer.options || undefined,
                section: classifySection(answer.canonicalKey),
                canonicalKey: answer.canonicalKey,
                confidence: answer.confidence || 0.5,
                filled: false,
                failed: false,
                skipped: !answer.answer,
                skipReason: !answer.answer ? 'No answer found' : undefined,
                filledValue: answer.answer,
                fileName: undefined,
                source: answer.source
            }));

            // Update fields state
            setFields(detectedFields);

            // Show success message
            console.log(`[Ext] ✅ Scan complete: ${questions.length} questions, ${c} canonical, ${f} fuzzy, ${ai} AI`);

            // AUTOMATION: Automatically trigger autofill run
            console.log('[Ext] ⚡ Automatically starting autofill run...');

            // Start filling tracking
            tracker.startFilling();

            // Record fill start time
            const fillStart = new Date();
            setPerformanceMetrics(prev => ({ ...prev, fillStarted: fillStart }));
            setIsFilling(true);

            try {
                console.log('[Ext] 🚀 Starting PRODUCTION fill via autofillRunner...');

                // Build payload for autofillRunner
                const payload = {
                    runId: `run_${Date.now()}`,
                    url: window.location.href,
                    jobId: jobUrl,
                    fields: map.data.filter((a: any) => a.answer).map((answer: any) => ({
                        questionText: answer.questionText,
                        fieldType: answer.fieldType,
                        value: answer.answer,
                        canonicalKey: answer.canonicalKey,
                        confidence: answer.confidence || 1.0,
                        selector: answer.selector,
                        options: answer.options,
                        fileName: answer.fileName // Include fileName!
                    }))
                };

                // Initialize progress
                const attemptedCount = payload.fields.length;
                setTotalAttempted(attemptedCount);
                setFillProgress({ current: 0, total: attemptedCount });

                console.log(`[Ext] 📊 Broadcasting autofill to all frames...`);

                // Use BROADCAST_AUTOFILL to send payload to all iframes
                await chrome.runtime.sendMessage({
                    action: 'BROADCAST_AUTOFILL',
                    payload: payload
                });

                const successfulFields = new Set<string>();
                const processedFieldNames = new Set<string>();

                // Wait for autofillRunner to signal completion (collect results from all frames)
                const result = await new Promise<{ successes: number; failures: number }>(resolve => {
                    const reportingFrames = new Set<number>();
                    const activeIds = scanResponse.activeFrameIds || [];
                    let timer: any = null;

                    const resolveResults = () => {
                        if (timer) clearTimeout(timer);
                        window.removeEventListener('AUTOFILL_COMPLETE_EVENT', completionHandler);
                        window.removeEventListener('FIELD_FILL_PROGRESS', progressHandler);
                        chrome.runtime.onMessage.removeListener(messageHandler);

                        const totalSuccesses = successfulFields.size;
                        const totalAttempted = payload.fields.length;
                        const totalFailures = Math.max(0, totalAttempted - totalSuccesses);

                        resolve({ successes: totalSuccesses, failures: totalFailures });
                    };

                    const checkAllDone = () => {
                        // We are done ONLY if all active frames have reported
                        const allActiveReported = activeIds.every((id: number) => reportingFrames.has(id));
                        const allFieldsProcessed = processedFieldNames.size >= attemptedCount;

                        if (allActiveReported && allFieldsProcessed) {
                            console.log('[OverlayPanel] ✅ All active frames reported & all fields processed. Resolving...');
                            if (timer) clearTimeout(timer);
                            // Short settle time now that we have accurate counting
                            timer = setTimeout(resolveResults, 500);
                        } else if (allActiveReported && !allFieldsProcessed) {
                            // Frames reported but some fields missing? Wait a bit more
                            if (timer) clearTimeout(timer);
                            timer = setTimeout(resolveResults, 3000);
                        } else {
                            // inactivity fallback
                            if (timer) clearTimeout(timer);
                            timer = setTimeout(resolveResults, 10000);
                        }
                    };

                    const progressHandler = (e: any) => {
                        const { questionText, ok } = e.detail;
                        if (questionText) {
                            processedFieldNames.add(questionText);
                            if (ok) {
                                successfulFields.add(questionText);
                                setFields(prev => prev.map(f =>
                                    f.questionText === questionText ? { ...f, filled: true, failed: false } : f
                                ));
                            } else {
                                setFields(prev => prev.map(f =>
                                    f.questionText === questionText ? { ...f, filled: false, failed: true } : f
                                ));
                            }

                            // Track fill result
                            tracker.trackFillResult(questionText, ok);

                            // Update UI progress
                            setFillProgress({ current: processedFieldNames.size, total: attemptedCount });
                        }
                        checkAllDone();
                    };

                    const completionHandler = (e: any) => {
                        console.log('[OverlayPanel] Received local completion event:', e.detail);
                        if (Array.isArray(e.detail.successfulFields)) {
                            e.detail.successfulFields.forEach((f: string) => {
                                successfulFields.add(f);
                                processedFieldNames.add(f);
                            });
                        }
                        reportingFrames.add(0); // Top frame is ID 0

                        // Update UI progress in case it jumped
                        setFillProgress({ current: processedFieldNames.size, total: attemptedCount });
                        checkAllDone();
                    };

                    const messageHandler = (message: any) => {
                        if (message.type === 'AUTOFILL_COMPLETE_RELAY') {
                            const frameId = message.payload.frameId;
                            console.log('[OverlayPanel] Received relayed completion from frame:', frameId);

                            if (frameId !== undefined) {
                                reportingFrames.add(frameId);
                            }

                            if (Array.isArray(message.payload.successfulFields)) {
                                message.payload.successfulFields.forEach((f: string) => {
                                    successfulFields.add(f);
                                    processedFieldNames.add(f);
                                });
                            }

                            setFillProgress({ current: processedFieldNames.size, total: attemptedCount });
                            checkAllDone();
                        } else if (message.type === 'FIELD_FILL_PROGRESS_RELAY') {
                            const { questionText, ok } = message.payload;
                            if (questionText) {
                                processedFieldNames.add(questionText);
                                if (ok) successfulFields.add(questionText);
                                setFillProgress({ current: processedFieldNames.size, total: attemptedCount });
                            }
                            checkAllDone();
                        }
                    };

                    window.addEventListener('AUTOFILL_COMPLETE_EVENT', completionHandler);
                    window.addEventListener('FIELD_FILL_PROGRESS', progressHandler);
                    chrome.runtime.onMessage.addListener(messageHandler);

                    // Safety timeout
                    setTimeout(resolveResults, 90000);

                    if (activeIds.length === 0 && attemptedCount === 0) {
                        timer = setTimeout(resolveResults, 1000);
                    }
                });

                // Record fill complete time
                const fillComplete = new Date();
                setPerformanceMetrics(prev => ({ ...prev, fillCompleted: fillComplete }));

                // End filling tracking
                tracker.endFilling();

                console.log('[Ext] ✅ Autofill complete - check console for detailed results');
                setIsFilling(false);

                // Update fields state to show finished status (redundancy check)
                setFields(prev => prev.map(f => {
                    const isSuccess = successfulFields.has(f.questionText);
                    const isProcessed = processedFieldNames.has(f.questionText);
                    return {
                        ...f,
                        filled: isSuccess,
                        failed: isProcessed && !isSuccess
                    };
                }));

                // Allow UI to render timestamp before showing feedback prompt
                setTimeout(async () => {
                    const currentFields = fieldsRef.current;
                    if (result.successes > 0 || result.failures > 0) {
                        // Pre-populate manual inputs with extension's analysis
                        setManualSuccess(result.successes);
                        setManualFail(result.failures);

                        // Show feedback UI and start 40s timer
                        setIsFeedbackVisible(true);
                        setShowFeedbackIntimation(true); // Show the popup
                        setFeedbackTimer(60);

                        // Find questions that failed or were required but not filled
                        const missed = currentFields.filter(f => f.failed || (f.isRequired && !f.filled && !f.filledValue))
                            .map(f => f.questionText);

                        console.log(`[Ext] Completion calculated: ${result.successes} succ, ${result.failures} fail. Missed: ${missed.length}`);

                        // We still set this if we want to show the 'missed' list in the sidebar, 
                        // but we won't show the POPUP anymore.
                        setCompletionResult({
                            ...result,
                            missedQuestions: Array.from(new Set(missed))
                        });

                        // Automatically switch to missed filter in the side panel if there are failures
                        if (result.failures > 0) {
                            setSelectedSection("missed");
                        }
                    }
                }, 100);
            } catch (e) {
                console.error('[Ext] Autofill execution error:', e);
                setIsFilling(false);
            }

        } catch (e) {
            console.error('[Ext] Scan error:', e);
            alert('❌ Error: ' + e);
        }
    };


    /**
     * Execute the autofill action
     * This function can be called automatically after scan or manually via button
     */
    const executeFill = async (): Promise<boolean> => {
        const stored = (window as any).__AWL_MAPPED__;
        if (!stored) {
            alert('⚠️ Run "Scan Application" first!');
            return false;
        }

        if (isFilling) {
            console.log('[Ext] Fill already in progress, skipping...');
            return false;
        }

        // Record fill start time
        const fillStart = new Date();
        setPerformanceMetrics(prev => ({ ...prev, fillStarted: fillStart }));

        setIsFilling(true);
        console.log('[Ext] 🚀 Starting autofill execution...');

        try {
            // Load profile to get file names
            const profile = await loadProfile();

            // Helper function to map field types to Selenium types
            const mapToSeleniumType = (fieldType: string): string => {
                if (fieldType.includes('dropdown_custom')) return 'dropdown_custom';
                if (fieldType.includes('select') || fieldType.includes('dropdown')) return 'dropdown_native';
                if (fieldType === 'radio') return 'radio';
                if (fieldType === 'checkbox') return 'checkbox';
                if (fieldType === 'textarea') return 'textarea';
                if (fieldType === 'file') return 'input_file';
                return 'input_text'; // Default for text, email, tel, number, etc.
            };

            const fillPlan = {
                jobUrl: stored.jobUrl,
                actions: stored.answers
                    .filter((a: any) => a.answer) // Only include fields with answers
                    .map((a: any) => {
                        const action: any = {
                            id: a.selector.replace(/[^a-zA-Z0-9_-]/g, '_'), // Sanitize ID
                            type: mapToSeleniumType(a.fieldType),
                            selector: a.selector,
                            value: a.answer,
                            required: a.required || false
                        };

                        // Add fileName for file uploads
                        if (a.fieldType === 'file' && profile) {
                            if (a.selector.includes('resume') && profile.documents?.resume?.fileName) {
                                action.fileName = profile.documents.resume.fileName;
                            } else if (a.selector.includes('cover') && profile.documents?.coverLetter?.fileName) {
                                action.fileName = profile.documents.coverLetter.fileName;
                            }
                        }

                        return action;
                    })
            };

            console.log('[Ext] 🚀 Sending fill plan to Selenium:', fillPlan);
            const fill = await chrome.runtime.sendMessage({ action: 'runSelenium', plan: fillPlan });

            if (fill.success) {
                console.log('[Ext] ✅ Fill complete:', fill.data);

                // Issue #6: Verify filled fields
                console.log('[Ext] 🔍 Verifying filled fields...');
                await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s for fields to settle

                // Count successes and failures
                const results = fill.data.results || {};
                const failures = Object.entries(results).filter(([id, status]) => status === 'failed');
                const successes = Object.entries(results).filter(([id, status]) => status === 'success');

                console.log(`[Ext] ✅ Verification: ${successes.length} succeeded, ${failures.length} failed`);

                if (failures.length > 0) {
                    const failedItems = failures.map(([id]) => id).join(', ');
                    console.warn(`[Ext] ⚠️ Failed fields: ${failedItems}`);

                    const retry = confirm(
                        `✅ Filled ${successes.length}/${successes.length + failures.length} fields\n\n` +
                        `⚠️ ${failures.length} fields failed:\n${failedItems}\n\n` +
                        `Would you like to retry failed fields?`
                    );

                    if (retry) {
                        console.log('[Ext] 🔄 Retrying failed fields...');
                        // Create retry plan with only failed actions
                        const retryPlan = {
                            jobUrl: stored.jobUrl,
                            actions: fillPlan.actions.filter((action: any) =>
                                failures.some(([id]) => id === action.id)
                            )
                        };

                        const retryFill = await chrome.runtime.sendMessage({
                            action: 'runSelenium',
                            plan: retryPlan
                        });

                        if (retryFill.success) {
                            const retryResults = retryFill.data.results || {};
                            const retrySuccesses = Object.entries(retryResults).filter(([, status]) => status === 'success').length;
                            alert("✅ application filling completed");
                        }
                    } else {
                        alert("✅ application filling completed");
                    }
                } else {
                    alert("✅ application filling completed");
                }

                // Record fill complete time
                const fillComplete = new Date();
                setPerformanceMetrics(prev => ({ ...prev, fillCompleted: fillComplete }));

                delete (window as any).__AWL_MAPPED__;
                setIsFilling(false);
                return true;
            } else {
                console.error('[Ext] ❌ Fill failed:', fill.error);
                alert('❌ Fill failed: ' + fill.error);
                setIsFilling(false);
                return false;
            }
        } catch (e) {
            console.error('[Ext] Fill error:', e);
            alert('❌ Error: ' + e);
            setIsFilling(false);
            return false;
        }
    };

    const handleManualSync = async () => {
        try {
            console.log('[Ext] ☁️ Starting Master Cloud Sync...');
            let profile = await loadProfile();

            // If email is missing, ask the user to provide it
            if (!profile?.personal.email) {
                const userEmail = prompt('⚠️ Your profile is incomplete. Please enter your email to "log in" and backup your data to the cloud:');

                if (!userEmail || !userEmail.includes('@')) {
                    alert('❌ Cloud Sync cancelled: A valid email is required to associate your backup.');
                    return;
                }

                // Update local profile with the provided email
                const updatedProfile = profile ? {
                    ...profile,
                    personal: { ...profile.personal, email: userEmail }
                } : {
                    ...EMPTY_PROFILE,
                    personal: { ...EMPTY_PROFILE.personal, email: userEmail }
                };

                await saveProfile(updatedProfile);
                profile = updatedProfile;
                console.log('[Ext] 👤 Profile updated with email for Cloud Sync:', userEmail);
            }

            setIsSyncing(true);

            // 1. Gather all local data
            const localPatterns = await patternStorage.getLocalPatterns();
            const aiCache = await getAllCached();

            // 2. Call Unified Backup Endpoint
            const response = await chrome.runtime.sendMessage({
                action: 'proxyFetch',
                url: `${CONFIG.API.AI_SERVICE}/api/user-data/backup`,
                options: {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: profile.personal.email,
                        profileData: profile,
                        patterns: localPatterns,
                        aiCache: aiCache
                    })
                }
            });

            if (response && response.success) {
                alert('✅ Master Sync Complete! Your profile, patterns, and cache are safely stored in the cloud.');
                console.log('[Ext] ✅ Master Sync Successful');
            } else {
                throw new Error(response?.error || 'Sync failed');
            }
        } catch (err: any) {
            console.error('[Ext] ❌ Master Sync Error:', err);
            alert('❌ Sync failed: ' + err.message);
        } finally {
            setIsSyncing(false);
        }
    };



    return (
        <div
            className={`autofill-floating-container ${viewState.toLowerCase()}`}
            style={{ left: `${position.x}px`, top: `${position.y}px` }}
            onMouseDown={handleDragStart}
        >
            {viewState === "ICON" && (
                <div className="floating-icon" onClick={handleIconClick}>
                    <div className="icon-bird">
                        <img
                            src={chrome.runtime.getURL('assets/icon256.png')}
                            alt="Logo"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                    </div>
                    <div className="close-x" onClick={handleClose}>×</div>
                </div>
            )}

            {viewState === "MENU" && (
                <div className="action-menu">
                    <div className="menu-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div className="drag-handle">⠿</div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                            <h3 style={{ margin: 0, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <img src={chrome.runtime.getURL('assets/icon256.png')} alt="logo" style={{ width: '18px', height: '18px' }} />
                                Autofill Assistant
                            </h3>
                            {statsSummary && (
                                <div style={{ fontSize: '9px', opacity: 0.9, marginTop: '2px', display: 'flex', flexDirection: 'column', gap: '1px', textAlign: 'center' }}>
                                    <span>Total users in the last 24 hours: {statsSummary.users.recent_24h}</span>
                                    <span>Total users: {statsSummary.users.total}</span>
                                </div>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <button className="gear-btn" onClick={() => setViewState("SETTINGS")} title="Settings">⚙️</button>
                            <div className="close-x" onClick={() => setViewState("ICON")}>×</div>
                        </div>
                    </div>
                    <div className="menu-content">
                        {/* {isWorkdayUrl && (
                            <a
                                href={window.location.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="run-autofill-btn workday-link"
                                style={{
                                    textDecoration: 'none',
                                    background: '#0073e6',
                                    display: 'block',
                                    textAlign: 'center'
                                }}
                            >
                                <span className="btn-icon">🏢</span> Workday Application
                            </a>
                        )} */}
                        <button
                            className="run-autofill-btn"
                            disabled={isFilling || isSyncing}
                            onClick={handleScan}
                        >
                            <span className="btn-icon">🔍</span> Scan Application
                        </button>
                        {/* <button className="run-autofill-btn" onClick={async () => {
                            const stored = (window as any).__AWL_MAPPED__;
                            if (!stored) {
                                alert('⚠️ Run "Scan Application" first!');
                                return;
                            }

                            // Record fill start time
                            const fillStart = new Date();
                            setPerformanceMetrics(prev => ({ ...prev, fillStarted: fillStart }));
                            setIsFilling(true);

                            try {
                                console.log('[Ext] 🚀 Starting PRODUCTION fill via autofillRunner...');

                                // Build payload for autofillRunner
                                const payload = {
                                    runId: `run_${Date.now()}`,
                                    url: window.location.href,
                                    jobId: stored.jobUrl,
                                    fields: stored.answers.filter((a: any) => a.answer).map((answer: any) => ({
                                        questionText: answer.questionText,
                                        fieldType: answer.fieldType,
                                        value: answer.answer,
                                        canonicalKey: answer.canonicalKey,
                                        confidence: answer.confidence || 1.0,
                                        selector: answer.selector,
                                        options: answer.options,
                                        fileName: answer.fileName // Include fileName!
                                    }))
                                };

                                // Initialize progress
                                const totalMapped = payload.fields.length;
                                setFillProgress({ current: 0, total: totalMapped });

                                console.log(`[Ext] 📊 Broadcasting ${payload.fields.length} fields to all frames...`);

                                // BROADCAST to all frames so that sub-frame results are captured
                                await chrome.runtime.sendMessage({
                                    action: 'BROADCAST_AUTOFILL',
                                    payload: payload
                                });

                                // Wait for autofillRunner to signal completion
                                const result = await new Promise<{ successes: number; failures: number }>(resolve => {
                                    const reportingFrames = new Set<number>();
                                    const processedFieldNames = new Set<string>();
                                    const successfulFields = new Set<string>();
                                    const activeIds = (window as any).__AWL_MAPPED__?.activeFrameIds || [];
                                    let timer: any = null;

                                    const resolveResults = () => {
                                        if (timer) clearTimeout(timer);
                                        window.removeEventListener('AUTOFILL_COMPLETE_EVENT', completionHandler);
                                        window.removeEventListener('FIELD_FILL_PROGRESS', progressHandler);
                                        chrome.runtime.onMessage.removeListener(messageHandler);
                                        resolve({ successes: successfulFields.size, failures: Math.max(0, totalMapped - successfulFields.size) });
                                    };

                                    const checkAllDone = () => {
                                        const allActiveReported = activeIds.every((id: number) => reportingFrames.has(id));
                                        const allFieldsProcessed = processedFieldNames.size >= totalMapped;

                                        if (allActiveReported && allFieldsProcessed) {
                                            if (timer) clearTimeout(timer);
                                            // accurate counting delay
                                            timer = setTimeout(resolveResults, 500);
                                        } else if (allActiveReported && !allFieldsProcessed) {
                                            if (timer) clearTimeout(timer);
                                            timer = setTimeout(resolveResults, 3000);
                                        } else {
                                            if (timer) clearTimeout(timer);
                                            timer = setTimeout(resolveResults, 10000);
                                        }
                                    };

                                    const progressHandler = (e: any) => {
                                        const { questionText, ok } = e.detail;
                                        if (questionText) {
                                            processedFieldNames.add(questionText);
                                            if (ok) successfulFields.add(questionText);
                                            setFillProgress({ current: processedFieldNames.size, total: totalMapped });
                                        }
                                        checkAllDone();
                                    };

                                    const completionHandler = (e: any) => {
                                        if (Array.isArray(e.detail.successfulFields)) {
                                            e.detail.successfulFields.forEach((f: string) => {
                                                successfulFields.add(f);
                                                processedFieldNames.add(f);
                                            });
                                        }
                                        reportingFrames.add(0);
                                        setFillProgress({ current: processedFieldNames.size, total: totalMapped });
                                        checkAllDone();
                                    };

                                    const messageHandler = (message: any) => {
                                        if (message.type === 'AUTOFILL_COMPLETE_RELAY') {
                                            if (Array.isArray(message.payload.successfulFields)) {
                                                message.payload.successfulFields.forEach((f: string) => {
                                                    successfulFields.add(f);
                                                    processedFieldNames.add(f);
                                                });
                                            }
                                            if (message.payload.frameId !== undefined) {
                                                reportingFrames.add(message.payload.frameId);
                                            }
                                            setFillProgress({ current: processedFieldNames.size, total: totalMapped });
                                            checkAllDone();
                                        } else if (message.type === 'FIELD_FILL_PROGRESS_RELAY') {
                                            const { questionText, ok } = message.payload;
                                            if (questionText) {
                                                processedFieldNames.add(questionText);
                                                if (ok) successfulFields.add(questionText);
                                                setFillProgress({ current: processedFieldNames.size, total: totalMapped });
                                            }
                                            checkAllDone();
                                        }
                                    };

                                    window.addEventListener('AUTOFILL_COMPLETE_EVENT', completionHandler);
                                    window.addEventListener('FIELD_FILL_PROGRESS', progressHandler);
                                    chrome.runtime.onMessage.addListener(messageHandler);

                                    // Safety timeout
                                    setTimeout(resolveResults, 90000);

                                    if (activeIds.length === 0 && totalMapped === 0) {
                                        timer = setTimeout(resolveResults, 1000);
                                    }
                                });

                                // Record fill complete time
                                const fillComplete = new Date();
                                setPerformanceMetrics(prev => ({ ...prev, fillCompleted: fillComplete }));

                                console.log('[Ext] ✅ Autofill complete - check console for detailed results');
                                setIsFilling(false);

                                // Show the missing result
                                setTimeout(() => {
                                    const currentFields = fieldsRef.current;
                                    if (result.successes > 0 || result.failures > 0) {
                                        // Retrieve missed questions from current fields state
                                        const missed = currentFields.filter(f => f.failed || (f.isRequired && !f.filled && !f.filledValue))
                                            .map(f => f.questionText);

                                        setCompletionResult({
                                            ...result,
                                            missedQuestions: Array.from(new Set(missed))
                                        });

                                        // Automatically switch to missed filter in the side panel
                                        if (result.failures > 0) {
                                            setSelectedSection("missed");
                                        }
                                    }
                                }, 100);

                            } catch (error) {
                                console.error('[Ext] Fill error:', error);
                                setIsFilling(false);
                            }
                        }} disabled={isFilling || isMapping || isSyncing}>
                            {isMapping ? '🧠 Mapping answers...' : (isFilling ? '⚡ Autofill Started...' : (isSyncing ? '⏳ Cloud Syncing...' : '⚡ Run Autofill Manually'))}
                        </button> */}
                        <button className="view-details-btn" onClick={() => setViewState("DETAILS")}>
                            View Detection Details
                        </button>
                        {/* <button
                            className="run-autofill-btn"
                            disabled={isFilling || isSyncing}
                            onClick={handleManualSync}
                            style={{
                                marginTop: '5px',
                                background: isSyncing ? '#e0e0e0' : '#f0f4ff',
                                color: isSyncing ? '#666' : '#3f51b5',
                                border: '1px solid #d0d7f7'
                            }}
                        >
                            <span className="btn-icon">{isSyncing ? '⏳' : '☁️'}</span>
                            {isSyncing ? 'Cloud Syncing...' : 'Sync to Cloud (Backup)'}
                        </button> */}
                    </div>
                </div>
            )}

            {viewState === "DETAILS" && (
                <div className="details-panel">
                    <div className="autofill-header">
                        <div className="drag-handle" style={{ marginRight: '4px' }}>⠿</div>
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                            <h3 style={{ margin: 0, fontSize: '13px', fontWeight: '700', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <img src={chrome.runtime.getURL('assets/icon48.png')} alt="logo" style={{ width: '16px', height: '16px' }} />
                                Autofill Assistant
                            </h3>
                            {statsSummary && (
                                <div style={{ fontSize: '9px', opacity: 0.9, marginTop: '1px', display: 'flex', gap: '5px' }}>
                                    <span>👥 {statsSummary.users.total} Users</span>
                                    <span>🧾 {statsSummary.feedback.total} Feedbacks</span>
                                    <span>💬 {statsSummary.feedback.recent_24h} Feedback</span>

                                </div>
                            )}
                        </div>
                        <div className="header-actions">
                            <button
                                className="action-btn"
                                onClick={() => setViewState("SETTINGS")}
                                title="Settings"
                            >
                                ⚙️
                            </button>
                            <button
                                onClick={() => setViewState("ICON")}
                                className="action-btn"
                                title="Minimize to Icon"
                            >
                                −
                            </button>
                            <button
                                onClick={handleClose}
                                className="action-btn"
                                style={{ background: 'rgba(255, 59, 48, 0.2)', border: '1px solid rgba(255, 59, 48, 0.3)' }}
                                title="Close Completely"
                            >
                                ×
                            </button>
                        </div>
                    </div>

                    <div className="view-tabs">
                        <button
                            className={viewMode === "fields" ? "active" : ""}
                            onClick={() => setViewMode("fields")}
                        >
                            Detection List
                        </button>
                        {/* <button
                            className={viewMode === "resume" ? "active" : ""}
                            onClick={() => setViewMode("resume")}
                        >
                            View Resume
                        </button> */}
                    </div>

                    <div className="autofill-content">
                        {viewMode === "fields" ? (
                            <>
                                {/* Stats Section */}
                                {isFeedbackVisible && (
                                    <div className="feedback-container" style={{ margin: '0 16px 12px 16px', borderRadius: '8px', border: '1px solid #eee', background: '#f8fdfb', display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', minHeight: '60px', justifyContent: 'center', alignItems: 'center' }}>
                                        {feedbackSubmittedMessage ? (
                                            <div style={{ color: '#00d084', fontWeight: '700', fontSize: '14px', animation: 'fadeIn 0.3s ease-out' }}>
                                                ✨ {feedbackSubmittedMessage}
                                            </div>
                                        ) : (
                                            <>
                                                <div className="feedback-message" style={{ fontSize: '12px', textAlign: 'center', fontWeight: '500' }}>
                                                    Please verify the counts below and submit:
                                                </div>
                                                <div className="feedback-inputs" style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                                                    <div className="feedback-input-group" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                                        <label style={{ fontSize: '10px', fontWeight: '700', color: '#666' }}>SUCCESS</label>
                                                        <input
                                                            type="number"
                                                            readOnly
                                                            style={{ width: '50px', textAlign: 'center', border: '1px solid #ddd', borderRadius: '4px', background: '#f5f5f5', color: '#888', cursor: 'not-allowed' }}
                                                            value={manualSuccess}
                                                        />
                                                    </div>
                                                    <div className="feedback-input-group" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                                        <label style={{ fontSize: '10px', fontWeight: '700', color: '#666' }}>FAILED</label>
                                                        <input
                                                            type="number"
                                                            style={{ width: '50px', textAlign: 'center', border: '1px solid #00d084', borderRadius: '4px', fontWeight: '700' }}
                                                            value={manualFail}
                                                            onChange={(e) => {
                                                                const val = Math.max(0, parseInt(e.target.value) || 0);
                                                                setManualFail(val);
                                                                setManualSuccess(Math.max(0, totalAttempted - val));
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                                <button className="feedback-submit-btn" onClick={() => submitFeedback(false)} style={{ background: '#00d084', color: 'white', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', width: '100%' }}>
                                                    Submit success ratio
                                                </button>
                                                <div className="feedback-timer" style={{ fontSize: '10px', color: '#999', textAlign: 'center', fontStyle: 'italic' }}>
                                                    Auto-syncing in <span style={{ color: '#ff3b30', fontWeight: '700' }}>{feedbackTimer}s</span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}

                                <div className="autofill-stats">
                                    <div className="stat">
                                        <span className="stat-label">Required:</span>
                                        <span className="stat-value">
                                            {stats.requiredFilled}/{stats.requiredTotal}
                                        </span>
                                        <span className="stat-percent">
                                            {stats.requiredPercent}%
                                        </span>
                                    </div>
                                    <div className="stat">
                                        <span className="stat-label">Optional:</span>
                                        <span className="stat-value">
                                            {stats.optionalFilled}/{stats.optionalTotal}
                                        </span>
                                        <span className="stat-percent">
                                            {stats.optionalPercent}%
                                        </span>
                                    </div>
                                </div>

                                {/* Page Analysis Section */}
                                {pageType && (
                                    <div className="page-analysis">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '11px', fontWeight: '600', color: '#666' }}>Structure:</span>
                                            <span className={`page-type-badge ${pageType}`}>
                                                {pageType === 'multi' ? '📑 Multi-Page Form' : '📄 Single-Page Form'}
                                            </span>
                                        </div>

                                    </div>
                                )}


                                {/* Performance Tracker */}
                                {performanceMetrics.scanStarted && (
                                    <div className="performance-tracker">
                                        <div className="performance-tracker-header">
                                            <span>⏱️</span>
                                            <span>Performance Tracker</span>
                                        </div>
                                        <div className="performance-timeline">
                                            {performanceMetrics.scanStarted && (
                                                <div className="perf-item">
                                                    <span className="perf-label">├─ Scan Started:</span>
                                                    <span className="perf-value">{formatTime(performanceMetrics.scanStarted)}</span>
                                                </div>
                                            )}
                                            {performanceMetrics.scanCompleted && (
                                                <div className="perf-item">
                                                    <span className="perf-label">├─ Scan Complete:</span>
                                                    <span className="perf-value">
                                                        {formatTime(performanceMetrics.scanCompleted)}
                                                        {performanceMetrics.scanStarted && (
                                                            <span className="perf-duration">
                                                                ({calculateDuration(performanceMetrics.scanStarted, performanceMetrics.scanCompleted)})
                                                            </span>
                                                        )}
                                                    </span>
                                                </div>
                                            )}
                                            {performanceMetrics.aiQuestionCount !== undefined && (
                                                <div className="perf-item">
                                                    <span className="perf-label">├─ Resolving Questions:</span>
                                                    <span className="perf-value">
                                                        {performanceMetrics.aiQuestionCount} ({performanceMetrics.aiCalls} AI + {performanceMetrics.cacheHits} Cache)
                                                    </span>
                                                </div>
                                            )}
                                            {aiStatus && (
                                                <div className="perf-item" style={{ marginLeft: '20px', fontSize: '10px', color: '#00d084' }}>
                                                    <span className="perf-label">│ {aiStatus}</span>
                                                </div>
                                            )}
                                            {/* AI Q&A Log */}
                                            {aiLog.length > 0 && (
                                                <div style={{ marginLeft: '20px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                    {aiLog.map((log, idx) => (
                                                        <div key={idx} style={{ fontSize: '10px', color: '#666' }}>
                                                            <span style={{ color: '#888', marginRight: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                {log.cached ? '💾' : <img src={chrome.runtime.getURL('assets/icon256.png')} alt="AI" style={{ width: '12px', height: '12px' }} />} {truncate(log.question, 15)}:
                                                            </span>
                                                            <span style={{ color: '#00d084', fontWeight: 'bold' }}>{truncate(log.answer, 20)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {performanceMetrics.mappingCompleted && (
                                                <div className="perf-item">
                                                    <span className="perf-label">├─ Mapping Complete:</span>
                                                    <span className="perf-value">
                                                        {formatTime(performanceMetrics.mappingCompleted)}
                                                        {performanceMetrics.scanCompleted && (
                                                            <span className="perf-duration">
                                                                ({calculateDuration(performanceMetrics.scanCompleted, performanceMetrics.mappingCompleted)})
                                                            </span>
                                                        )}
                                                    </span>
                                                </div>
                                            )}
                                            {performanceMetrics.fillStarted && (
                                                <div className="perf-item">
                                                    <span className="perf-label">├─ Fill Started:</span>
                                                    <span className="perf-value">{formatTime(performanceMetrics.fillStarted)}</span>
                                                </div>
                                            )}
                                            {fillProgress && (
                                                <div className="perf-item">
                                                    <span className="perf-label">├─ Filling:</span>
                                                    <span className="perf-value" style={{ color: fillProgress.current === fillProgress.total ? '#00d084' : '#ff922b' }}>
                                                        {fillProgress.current} / {fillProgress.total} fields
                                                    </span>
                                                </div>
                                            )}
                                            {performanceMetrics.fillCompleted && (
                                                <div className="perf-item">
                                                    <span className="perf-label">├─ Fill Complete:</span>
                                                    <span className="perf-value">
                                                        {formatTime(performanceMetrics.fillCompleted)}
                                                        {performanceMetrics.fillStarted && (
                                                            <span className="perf-duration">
                                                                ({calculateDuration(performanceMetrics.fillStarted, performanceMetrics.fillCompleted)})
                                                            </span>
                                                        )}
                                                    </span>
                                                </div>
                                            )}
                                            {performanceMetrics.scanStarted && performanceMetrics.fillCompleted && (
                                                <div className="perf-total">
                                                    <span>└─ Total Duration:</span>
                                                    <span className="perf-total-value">
                                                        {calculateDuration(performanceMetrics.scanStarted, performanceMetrics.fillCompleted)}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Section Filter */}
                                <div className="section-filter">
                                    <button
                                        className={selectedSection === "all" ? "active" : ""}
                                        onClick={() => setSelectedSection("all")}
                                    >
                                        All ({fields.length})
                                    </button>
                                    <button
                                        className={`missed ${selectedSection === "missed" ? "active" : ""}`}
                                        onClick={() => setSelectedSection("missed")}
                                    >
                                        Missed ({stats.missedTotal})
                                    </button>
                                    {Object.keys(fieldsBySection).map((section) => (
                                        <button
                                            key={section}
                                            className={selectedSection === section ? "active" : ""}
                                            onClick={() => setSelectedSection(section as QuestionSection)}
                                        >
                                            {formatSectionName(section as QuestionSection)} (
                                            {fieldsBySection[section as QuestionSection].length})
                                        </button>
                                    ))}
                                </div>

                                {/* Fields List */}
                                <div className="fields-list">
                                    {(selectedSection === "missed"
                                        ? fields.filter(f => f.failed || (f.isRequired && !f.filled && !f.filledValue))
                                        : filteredFields).map((field, index) => (
                                            <FieldItem
                                                key={field.selector || index}
                                                field={field}
                                                onUpdate={(val) => handleFieldUpdate(fields.indexOf(field), val)}
                                            />
                                        ))}
                                </div>
                            </>
                        ) : (
                            <div className="resume-viewer">
                                <div className="resume-viewer-header">
                                    <button
                                        className="copy-btn"
                                        onClick={() => {
                                            navigator.clipboard.writeText(resumeText);
                                            alert("Resume text copied to clipboard!");
                                        }}
                                    >
                                        Copy Resume Text
                                    </button>
                                </div>
                                <pre>{resumeText || "No resume content found. Please upload a resume during onboarding."}</pre>
                            </div>
                        )}
                    </div>

                    {/* <div className="panel-footer">
                        <button className="run-autofill-btn mini" onClick={handleRunAutofill}>
                            ⚡ Rerun Autofill
                        </button>
                    </div> */}

                    {notification && (
                        <div style={{
                            position: 'absolute',
                            bottom: '60px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            background: '#00d084',
                            color: 'white',
                            padding: '8px 16px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                            zIndex: 1000,
                            whiteSpace: 'nowrap',
                            animation: 'fadeInOut 3s forwards'
                        }}>
                            {notification.message}
                        </div>
                    )}

                    {(showFeedbackIntimation && isFeedbackVisible) && (
                        <div className="completion-backdrop">
                            <div className="completion-notification" style={{ maxWidth: '300px' }} onClick={e => e.stopPropagation()}>
                                <div className="completion-header" style={{ background: '#f8f9fa', color: '#333', borderBottom: '1px solid #eee' }}>📊 Feedback Required</div>
                                <div className="feedback-container" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div className="feedback-message" style={{ fontSize: '13px', lineHeight: '1.5', color: '#666', textAlign: 'center' }}>
                                        Application filled! Please check the application and enter how many are filled and how many failed in the side panel. Your feedback is very important.
                                    </div>

                                    <button className="feedback-submit-btn" onClick={() => {
                                        setShowFeedbackIntimation(false);
                                        setViewState("DETAILS");
                                    }} style={{ background: '#212529', color: 'white', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>
                                        Go to Panel
                                    </button>

                                    <div className="feedback-timer" style={{ fontSize: '11px', color: '#999', textAlign: 'center' }}>
                                        Auto-syncing in <span style={{ color: '#ff3b30', fontWeight: '600' }}>{feedbackTimer}s</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        // ) : completionResult && !isFeedbackVisible && (
                        //         <div className="completion-notification" onClick={e => e.stopPropagation()}>
                        //             <div className="completion-header">🎉 Analysis Complete</div>
                        //             <div className="completion-stats">
                        //                 <div className="stat-row success">
                        //                     <span>Fields Succeeded</span>
                        //                     <span>{completionResult.successes}</span>
                        //                 </div>
                        //                 <div className="stat-row missed">
                        //                     <span>Fields Missed</span>
                        //                     <span>{completionResult.failures}</span>
                        //                 </div>
                        //             </div>

                        //             {completionResult.missedQuestions.length > 0 && (
                        //                 <div className="missed-questions-list">
                        //                     <div style={{ fontWeight: '600', marginBottom: '4px', borderBottom: '1px solid #eee', paddingBottom: '2px' }}>
                        //                         Missed Questions:
                        //                     </div>
                        //                     {completionResult.missedQuestions.map((q: string, i: number) => (
                        //                         <div key={i} className="missed-question-item" title={q}>
                        //                             • {q}
                        //                         </div>
                        //                     ))}
                        //                 </div>
                        //             )}

                        //             <button
                        //                 className="close-notification-btn"
                        //                 onClick={() => setCompletionResult(null)}
                        //             >
                        //                 Got it!
                        //             </button>
                        //         </div>
                        //     )}
                    )}
                </div>
            )}

            {
                viewState === "SETTINGS" && (
                    <div className="details-panel">
                        <div className="autofill-header">
                            <div className="drag-handle" style={{ marginRight: '8px' }}>⠿</div>
                            <h3 style={{ margin: 0, fontSize: '14px', flex: 1 }}>⚙️ Settings & Tools</h3>
                            <div className="header-actions">
                                <button
                                    onClick={() => setViewState("DETAILS")}
                                    className="action-btn"
                                    title="Back to Detection"
                                >
                                    ←
                                </button>
                                <button
                                    onClick={() => setViewState("ICON")}
                                    className="action-btn"
                                    title="Minimize"
                                >
                                    −
                                </button>
                                <button
                                    onClick={handleClose}
                                    className="action-btn"
                                    style={{ background: 'rgba(255, 59, 48, 0.2)', border: '1px solid rgba(255, 59, 48, 0.3)' }}
                                    title="Close"
                                >
                                    ×
                                </button>
                            </div>
                        </div>

                        <div className="autofill-content">
                            <div className="settings-list">
                                <span style={{ textAlign: 'center', fontSize: '14px' }}>For these all cards, confirmation box will show</span>
                                <div className="settings-item" onClick={() => {
                                    if (confirm("Do you want to edit your profile? This will open your current info in a new tab.")) {
                                        window.open(chrome.runtime.getURL('onboarding.html?mode=edit'), '_blank');
                                    }
                                }}>
                                    <div className="settings-item-title">👤 Edit Profile</div>
                                    <div className="settings-item-desc">Modify your personal info, experience, and skills pre-filled with your current data.</div>
                                    <div className="settings-item-btn">Configure Profile →</div>
                                </div>

                                <div className="settings-item" onClick={() => {
                                    if (confirm("Report an Issue? This will open our feedback form in a new tab.")) {
                                        window.open("https://extension-feedback-from.vercel.app/", '_blank');
                                    }
                                }}>
                                    <div className="settings-item-title">📧 Report an Issue</div>
                                    <div className="settings-item-desc">Encountered a bug or have a suggestion? Reach out to our technical team.</div>
                                    <div className="settings-item-btn">Get Support →</div>
                                </div>

                                <div className={`settings-item ${isSyncing ? 'active' : ''}`} onClick={() => {
                                    if (isSyncing) return;
                                    if (confirm("Start Cloud Sync? This will backup your profile, patterns, and AI cache to the cloud.")) {
                                        handleManualSync();
                                    }
                                }}>
                                    <div className="settings-item-title">☁️ Cloud Sync - Backup your data</div>
                                    <div className="settings-item-desc">Independently backup your profile, patterns, and AI cache to the cloud to use from any device through email.</div>
                                    <div className="settings-item-btn">
                                        {isSyncing ? <><span className="spinner" style={{ marginRight: '8px' }}></span> Syncing...</> : 'Sync Now →'}
                                    </div>
                                </div>

                                {/* <div className={`settings-item ${isClearingCache ? 'active' : ''}`} onClick={async () => {
                                if (isClearingCache) return;
                                if (confirm("Are you sure you want to clear the AI cache? This will refresh all AI answers.")) {
                                    setIsClearingCache(true);
                                    try {
                                        const { clearAllCache } = await import("../../core/storage/aiResponseCache");
                                        await clearAllCache();
                                        alert("AI Cache cleared successfully! ✨");
                                    } finally {
                                        setIsClearingCache(false);
                                    }
                                }
                            }}>
                                <div className="settings-item-title">🧠 Clear AI Cache</div>
                                <div className="settings-item-desc">Wipe stored AI answers to force fresh responses and re-learning of questions.
                                    Before doing this, first backup your data using the "Master Cloud Sync" button.
                                </div>
                                <div className="settings-item-btn">
                                    {isClearingCache ? <><span className="spinner" style={{ marginRight: '8px' }}></span> Clearing...</> : 'Clear Cache →'}
                                </div>
                            </div> */}



                                {/* <div className={`settings-item danger ${isClearingAll ? 'active' : ''}`} onClick={async () => {
                                if (isClearingAll) return;
                                if (confirm("⚠️ CRITICAL: Are you sure you want to clear ALL data? This includes your profile, patterns, and cloud link. This cannot be undone.")) {
                                    setIsClearingAll(true);
                                    chrome.storage.local.clear(() => {
                                        alert("All local data cleared successfully. Reloading extension...");
                                        window.location.reload();
                                    });
                                }
                            }}>
                                <div className="settings-item-title">🗑️ Clear All Data</div>
                                <div className="settings-item-desc">Permanently delete all profile data and extension settings only from this device, doesn't effects on DB data, even after doing this operation we have this user data in database. you can restore with email</div>
                                <div className="settings-item-btn">
                                    {isClearingAll ? <><span className="spinner" style={{ marginRight: '8px' }}></span> Wiping...</> : 'Wipe Everything →'}
                                </div>
                            </div> */}
                            </div>
                        </div>

                        <div className="panel-footer" style={{ textAlign: 'center', fontSize: '10px', color: '#999', marginTop: '20px', paddingBottom: '10px' }}>
                            Job Application Autofill v1.3.0
                        </div>
                    </div>
                )
            }
        </div >
    );
};

const FieldItem: React.FC<{ field: DetectedField; onUpdate: (val: string) => void }> = ({ field, onUpdate }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(field.filledValue || "");

    // Sync state when field prop changes (e.g. after background mapping completes)
    useEffect(() => {
        setEditValue(field.filledValue || "");
    }, [field.filledValue]);

    const handleFocus = () => {
        field.element.scrollIntoView({ behavior: "smooth", block: "center" });
        field.element.focus();
    };

    const handleSave = async (e: React.MouseEvent) => {
        e.stopPropagation();

        // 1. Update DOM element
        try {
            const result = await fillField(field, editValue);
            console.log(`Assistant manual fill result:`, result);
        } catch (err) {
            console.error("Failed to fill DOM element from assistant:", err);
        }

        // 2. Update profile if canonical key is available
        const isUnknown = !field.canonicalKey || field.canonicalKey.toLowerCase() === 'unknown';

        try {
            const currentProfile = await loadProfile();
            if (currentProfile) {
                // ALWAYS store as custom answer to ensure Phase -2 (Manual Override) picks it up next time.
                // We store under BOTH Question Text (for exact matching) and Intent (for cross-page consistency)
                const customAnswers = {
                    ...currentProfile.customAnswers,
                    [field.questionText]: editValue
                };

                // If we have a known intent, also store under the intent key
                if (!isUnknown && field.canonicalKey) {
                    customAnswers[field.canonicalKey] = editValue;
                }

                let updatedProfile = { ...currentProfile, customAnswers };

                // Also update the specific canonical field if known
                if (!isUnknown) {
                    console.log(`[Ext] Updating specific profile field: ${field.canonicalKey}`);
                    // We'll use a local update logic here to be safe
                    const keys = field.canonicalKey!.split('.');
                    let current = updatedProfile as any;
                    for (let i = 0; i < keys.length - 1; i++) {
                        if (current[keys[i]]) current = current[keys[i]];
                        else break;
                    }
                    const lastKey = keys[keys.length - 1];
                    if (current && typeof current === 'object') {
                        current[lastKey] = editValue;
                    }
                }

                const { saveProfile } = await import("../../core/storage/profileStorage");
                await saveProfile(updatedProfile);
                console.log(`[Ext] Manual choice stored in customAnswers (Phase -2) for: ${field.questionText}`);
            }
        } catch (err) {
            console.error("Failed to store manual override:", err);
        }

        // 3. Persist to Learned Patterns for future recognition (only if it's a known intent)
        if (!isUnknown) {
            try {
                await patternStorage.addPattern({
                    questionPattern: field.questionText,
                    intent: field.canonicalKey!,
                    canonicalKey: field.canonicalKey!,
                    fieldType: field.fieldType,
                    confidence: 1.0,
                    source: 'manual',
                    answerMappings: [{
                        canonicalValue: editValue,
                        variants: [editValue]
                    }]
                });
                console.log(`[Ext] Learned mapping for: ${field.questionText}`);
            } catch (err) {
                console.warn("[Ext] Failed to learn pattern:", err);
            }
        } else {
            console.log(`[Ext] Skipping pattern learning for unknown intent: ${field.questionText}`);
        }

        onUpdate(editValue);
        setIsEditing(false);
    };

    const handleEditClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsEditing(true);
    };

    return (
        <div
            className={`field-item ${field.filled ? "filled" : ""} ${field.failed ? "failed" : ""} ${field.skipped && field.filledValue ? "suggested" : ""} ${field.skipped && !field.filledValue ? "skipped" : ""
                } ${field.confidence < 0.6 ? "low-confidence" : ""}`}
            onClick={handleFocus}
        >
            <div className="field-header">
                <span className="field-question">{field.questionText}</span>
                {field.isRequired && <span className="required-badge">Required</span>}
            </div>

            <div className="field-details">
                <span className="field-type">{field.fieldType}</span>

                {!isEditing && field.filledValue && (
                    <span className={`field-status ${field.filled ? "filled" : "suggested"}`}>
                        {field.filled && <span style={{ marginRight: '4px' }}>✓</span>}
                        {field.source === 'canonical' || field.source === 'hardcoded' || field.source === 'hardcoded_override' ? "📋 Profile: " :
                            field.source === 'learned' ? "🧠 Learned: " :
                                field.source === 'fuzzy' ? "🔍 Fuzzy: " :
                                    field.source === 'injected_skills' ? "🎨 Skill: " :
                                        "⚡ AI: "}
                        {field.filledValue === true || field.filledValue === "true" ? "Yes" :
                            field.filledValue === false || field.filledValue === "false" ? "No" :
                                truncate(String(field.filledValue || ""), 30)}
                    </span>
                )}

                {field.failed && !isEditing && (
                    <span className="field-status failed">
                        ❌ Missed
                    </span>
                )}

                {field.skipped && !field.filledValue && !isEditing && (
                    <span className="field-status skipped">
                        ⊘ {field.skipReason}
                    </span>
                )}

                {field.confidence > 0 && (
                    <span className={`confidence ${field.confidence > 0.8 ? "high" : field.confidence > 0.5 ? "mid" : "low"}`}>
                        Confidence: {(field.confidence * 100).toFixed(0)}%
                    </span>
                )}

                {!isEditing && (
                    <button className="edit-btn" onClick={handleEditClick}>
                        {field.filledValue ? "Edit" : "Add Answer"}
                    </button>
                )}
            </div>

            {isEditing && (
                <div className="edit-field-ui" onClick={(e) => e.stopPropagation()}>
                    {field.options && field.options.length > 0 ? (
                        <select
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            autoFocus
                        >
                            <option value="">Select an option...</option>
                            {field.options.map((opt, i) => (
                                <option key={i} value={opt}>{opt}</option>
                            ))}
                        </select>
                    ) : (
                        <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            autoFocus
                            placeholder={`Enter ${field.questionText}...`}
                        />
                    )}
                    <div className="edit-actions">
                        <button className="save-btn" onClick={handleSave}>Save & Store</button>
                        <button className="cancel-btn" onClick={() => setIsEditing(false)}>Cancel</button>
                    </div>
                </div>
            )}

            {field.canonicalKey && (
                <div className="field-mapping">
                    Mapped to: <code>{field.canonicalKey}</code>
                </div>
            )}
        </div>
    );
};

// Helper functions

function calculateStats(fields: DetectedField[]) {
    const requiredTotal = fields.filter((f) => f.isRequired).length;
    const requiredFilled = fields.filter((f) => f.isRequired && f.filled).length;
    const optionalTotal = fields.filter((f) => !f.isRequired).length;
    const optionalFilled = fields.filter((f) => !f.isRequired && f.filled).length;
    const missedTotal = fields.filter(f => f.failed || (f.isRequired && !f.filled && !f.filledValue)).length;

    return {
        requiredTotal,
        requiredFilled,
        requiredPercent: requiredTotal > 0 ? Math.round((requiredFilled / requiredTotal) * 100) : 0,
        optionalTotal,
        optionalFilled,
        optionalPercent: optionalTotal > 0 ? Math.round((optionalFilled / optionalTotal) * 100) : 0,
        missedTotal
    };
}

function groupBySection(fields: DetectedField[]): Record<QuestionSection, DetectedField[]> {
    const grouped: Record<string, DetectedField[]> = {};

    fields.forEach((field) => {
        if (!grouped[field.section]) {
            grouped[field.section] = [];
        }
        grouped[field.section].push(field);
    });

    return grouped as Record<QuestionSection, DetectedField[]>;
}

function formatSectionName(section: QuestionSection): string {
    const names: Record<QuestionSection, string> = {
        [QuestionSection.PERSONAL]: "Personal",
        [QuestionSection.EDUCATION]: "Education",
        [QuestionSection.EXPERIENCE]: "Experience",
        [QuestionSection.SKILLS]: "Skills",
        [QuestionSection.WORK_AUTHORIZATION]: "Work Auth",
        [QuestionSection.EEO]: "EEO",
        [QuestionSection.PREFERENCES]: "Preferences",
        [QuestionSection.OTHER]: "Other",
    };

    return names[section] || section;
}

function truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
}

// Render function called from content script - SHADOW DOM IMPLEMENTATION
export function renderOverlayPanel(
    fields: DetectedField[],
    onAutoFill: () => Promise<void>,
    onFieldUpdate: (index: number, field: DetectedField) => void
) {
    let host = document.getElementById("autofill-extension-host");

    if (!host) {
        // Create the HOST element in the DOM
        host = document.createElement("div");
        host.id = "autofill-extension-host";
        document.documentElement.appendChild(host);

        // Create Shadow DOM
        const shadow = host.attachShadow({ mode: "open" });

        // Inject Styles into Shadow DOM
        const styleTag = document.createElement("style");
        styleTag.textContent = STYLES;
        shadow.appendChild(styleTag);

        // Create Mount Point inside Shadow DOM
        const mountPoint = document.createElement("div");
        mountPoint.id = "autofill-root";
        shadow.appendChild(mountPoint);

        // Store root reference on the host for future updates
        (host as any)._reactRoot = createRoot(mountPoint);
    }

    // Render using the stored React Root
    const reactRoot = (host as any)._reactRoot as Root;
    if (reactRoot) {
        reactRoot.render(
            <OverlayPanel
                fields={fields}
                onAutoFill={onAutoFill}
                onFieldUpdate={onFieldUpdate}
            />
        );
    }
}

export function unmountOverlay() {
    const host = document.getElementById("autofill-extension-host");
    if (host) {
        if ((host as any)._reactRoot) {
            (host as any)._reactRoot.unmount();
        }
        host.remove();
    }
}
