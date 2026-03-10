# Which Button to Click for Workday Applications?

![UI Screenshot](C:/Users/DELL/.gemini/antigravity/brain/2a5238d3-bf80-49a3-9f17-175c2e7293c9/uploaded_media_1769406984256.png)

## ✅ **Answer: Click "Scan Application" Button (Green)**

## 🎯 Button Explanation

### 🏢 **"Workday Application" (Blue Button)**
- **What it does**: Opens the current Workday page in a **new tab**
- **When to use**: If you want to open another instance of the page
- **Code**: `<a href={window.location.href} target="_blank">` (Just a link!)
- **❌ Does NOT autofill**: This is just a simple hyperlink

### 🔍 **"Scan Application" (Green Button)** ← **USE THIS ONE!**
- **What it does**: 
  1. Scans the Workday application form
  2. Maps questions to your profile
  3. **Automatically detects if it's Workday** and uses the specialized handler
  4. Fills all fields with Country FIRST
  5. Waits for form reload
  6. Fills remaining fields
- **When to use**: **ALWAYS** - This is the main autofill button!
- **✅ This triggers the Workday handler we just created**

### ⚡ **"Run Autofill Manually" (Green Button)**
- **What it does**: Fills fields using data from a previous scan
- **When to use**: If you already scanned but want to fill again
- **Requires**: Must have already clicked "Scan Application" first

---

## 🔄 **How It Works (Behind the Scenes)**

When you click **"Scan Application"**:

```
1. FormScanner.scan() → Finds all form fields
2. QuestionMapper → Maps to your profile data
3. START_AUTOFILL_EVENT → Triggers autofillRunner
4. autofillRunner detects Workday → Routes to WorkdayHandler ✨
5. WorkdayHandler:
   - Fills Country FIRST ⭐
   - Waits for network
   - Re-scans for new fields
   - Fills remaining fields
6. Shows success message
```

---

## 📊 **The Code Proof**

### "Scan Application" Button (Line 819-949):
```typescript
<button className="run-autofill-btn" onClick={async () => {
    // 1. Scan form
    const questions = await scanner.scan();
    
    // 2. Map to profile
    const map = await chrome.runtime.sendMessage({ 
        action: 'mapAnswers', 
        questions: questions 
    });
    
    // 3. Trigger autofill
    const payload = { url, fields: map.data };
    const event = new CustomEvent('START_AUTOFILL_EVENT', { 
        detail: payload 
    });
    window.dispatchEvent(event); // ← This triggers WorkdayHandler!
}}>
    🔍 Scan Application
</button>
```

### autofillRunner.ts (Your File):
```typescript
async function runAutofill(payload: FillPayload) {
    // WORKDAY DETECTION: Use specialized handler
    if (isWorkdayApplication()) {  // ← Automatic detection!
        console.log(`🏢 WORKDAY APPLICATION DETECTED`);
        await handleWorkdayApplication(payload); // ← Uses our handler!
        return;
    }
    
    // ... standard flow for other platforms
}
```

---

## ✅ **Step-by-Step Instructions**

### For Workday Applications:

1. **Navigate** to the Workday application page
2. **Click the floating logo** to open the menu
3. **Click "🔍 Scan Application"** (green button)
4. **Wait** - You'll see:
   ```
   [Ext] 🔍 Scanning current page...
   [WorkdayHandler] 🏢 WORKDAY APPLICATION DETECTED
   [WorkdayHandler] ⭐ COUNTRY field will be filled FIRST
   [WorkdayHandler] ✅ Workday application fill complete
   ```
5. **Check console** for detailed logs
6. **Verify** the form is filled correctly

---

## ❓ **Why is there a "Workday Application" button then?**

Good question! Looking at the code (line 803-818), it's just a **convenience link**:

```typescript
{isWorkdayUrl && (
    <a href={window.location.href} target="_blank">
        🏢 Workday Application
    </a>
)}
```

This appears **only when the URL contains "workday"** and just opens a new tab. It's **NOT** the autofill button!

---

## 🎯 **TL;DR**

| Button | Action | When to Use |
|--------|--------|-------------|
| 🏢 **Workday Application** | Opens new tab | ❌ Don't use for autofill |
| 🔍 **Scan Application** | **Scans + Fills** | ✅ **USE THIS!** |
| ⚡ **Run Autofill Manually** | Fills from previous scan | ⚠️ Only after scanning |

**For Workday**: Always click **"🔍 Scan Application"**!

The Workday handler will **automatically activate** when it detects you're on a Workday page! 🎉
